import { useState, useRef, useEffect, useCallback } from "react";
import { TeletypeToast } from "../types";

export interface ExtendedTeletypeToast extends TeletypeToast {
  actionLabel?: string;
  onAction?: () => void;
}

export function useTeletypeToasts() {
  const [toasts, setToasts] = useState<ExtendedTeletypeToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      message: string,
      type: "DISPATCH" | "SUCCESS" | "VERIFIED" | "SCAN" | "ERROR" = "DISPATCH",
      actionLabel?: string,
      onAction?: () => void
    ) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ExtendedTeletypeToast = {
        id,
        type,
        message,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        ...(actionLabel ? { actionLabel, onAction } : {}),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 2)]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, 4500);

      timersRef.current.set(id, timer);
      return id;
    },
    [dismissToast]
  );

  // Clean up all pending timeouts on unmount to prevent leaks or orphaned timers
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return {
    toasts,
    addToast,
    dismissToast,
  };
}
