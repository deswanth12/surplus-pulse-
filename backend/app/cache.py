"""SurplusPulse In-Memory Thread-Safe Caching Service.
Provides TTL-based expiration and event-driven tag invalidation.
"""
from __future__ import annotations

import copy
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from app.config import settings


@dataclass
class CacheEntry:
    value: Any
    expires_at: float  # time.monotonic()
    tags: set[str] = field(default_factory=set)
    created_at: float = field(default_factory=time.monotonic)
    last_accessed: float = field(default_factory=time.monotonic)
    access_seq: int = 0


class CacheService:
    """Thread-safe in-memory cache supporting TTL expiration, tag-based invalidation, and capacity eviction."""

    def __init__(self, max_size: int = 1000) -> None:
        self._max_size = max(1, max_size)
        self._lock = threading.Lock()
        self._entries: dict[str, CacheEntry] = {}
        self._tag_to_keys: dict[str, set[str]] = {}
        self._counter: int = 0

    @property
    def max_size(self) -> int:
        return self._max_size

    def get(self, key: str) -> Optional[Any]:
        """Retrieves a cached value by key if present and not expired."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            now = time.monotonic()
            if now >= entry.expires_at:
                self._remove_key_locked(key)
                return None
            self._counter += 1
            entry.last_accessed = now
            entry.access_seq = self._counter
            return copy.deepcopy(entry.value)

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: float,
        tags: Optional[list[str] | set[str]] = None,
    ) -> None:
        """Stores a value in the cache with a specific TTL and optional tags."""
        tags_set = set(tags or [])
        now = time.monotonic()
        expires_at = now + ttl_seconds
        with self._lock:
            if key in self._entries:
                self._remove_key_locked(key)

            # Enforce upper capacity ceiling before inserting new entry
            if len(self._entries) >= self._max_size:
                # 1. Opportunistic eviction of expired entries
                expired_keys = [k for k, e in self._entries.items() if now >= e.expires_at]
                for exp_k in expired_keys:
                    self._remove_key_locked(exp_k)

                # 2. If still at max capacity, evict oldest entry (FIFO/LRU by access_seq)
                while len(self._entries) >= self._max_size and self._entries:
                    oldest_k = min(
                        self._entries.keys(),
                        key=lambda k: self._entries[k].access_seq,
                    )
                    self._remove_key_locked(oldest_k)

            self._counter += 1
            self._entries[key] = CacheEntry(
                value=copy.deepcopy(value),
                expires_at=expires_at,
                tags=tags_set,
                created_at=now,
                last_accessed=now,
                access_seq=self._counter,
            )
            for tag in tags_set:
                if tag not in self._tag_to_keys:
                    self._tag_to_keys[tag] = set()
                self._tag_to_keys[tag].add(key)

    def invalidate_tag(self, tag: str) -> int:
        """Invalidates all cached entries associated with the specified tag."""
        with self._lock:
            keys = self._tag_to_keys.pop(tag, set())
            count = 0
            for key in list(keys):
                if key in self._entries:
                    self._remove_key_locked(key)
                    count += 1
            return count

    def clear(self) -> None:
        """Completely purges all entries and tag indices from the cache."""
        with self._lock:
            self._entries.clear()
            self._tag_to_keys.clear()

    def size(self) -> int:
        """Returns the number of active unexpired entries in the cache."""
        with self._lock:
            now = time.monotonic()
            expired_keys = [k for k, e in self._entries.items() if now >= e.expires_at]
            for k in expired_keys:
                self._remove_key_locked(k)
            return len(self._entries)

    def _remove_key_locked(self, key: str) -> None:
        entry = self._entries.pop(key, None)
        if entry:
            for tag in entry.tags:
                keys = self._tag_to_keys.get(tag)
                if keys:
                    keys.discard(key)
                    if not keys:
                        self._tag_to_keys.pop(tag, None)


cache_service = CacheService(max_size=settings.cache_max_size)
