"""SurplusPulse Database & Seed Layer.
SQLite with WAL mode and realistic urban food rescue entities.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone, timedelta

from app.config import settings

DB_PATH = settings.db_path

# Status Constants
STATUS_POSTED = "POSTED"
STATUS_CLAIMED = "CLAIMED"
STATUS_COLLECTED = "COLLECTED"
STATUS_DELIVERED = "DELIVERED"
STATUS_EXPIRED = "EXPIRED"

VALID_STATUSES = (STATUS_POSTED, STATUS_CLAIMED, STATUS_COLLECTED, STATUS_DELIVERED, STATUS_EXPIRED)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS donors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                donor_type TEXT NOT NULL, -- RESTAURANT, CATERER, HOSTEL_MESS, WEDDING_VENUE
                contact_name TEXT NOT NULL,
                contact_phone TEXT NOT NULL,
                address TEXT NOT NULL,
                city TEXT NOT NULL DEFAULT 'Bengaluru',
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS receivers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                receiver_type TEXT NOT NULL, -- NGO, SHELTER, COMMUNITY_KITCHEN, VOLUNTEER_HUB
                contact_name TEXT NOT NULL,
                contact_phone TEXT NOT NULL,
                capacity_meals INTEGER NOT NULL,
                address TEXT NOT NULL,
                city TEXT NOT NULL DEFAULT 'Bengaluru',
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS food_listings (
                id TEXT PRIMARY KEY,
                donor_id TEXT NOT NULL REFERENCES donors(id),
                food_name TEXT NOT NULL,
                food_category TEXT NOT NULL, -- VEG, NON_VEG
                quantity_meals INTEGER NOT NULL,
                quantity_kg REAL NOT NULL,
                storage_type TEXT NOT NULL, -- HOT, AMBIENT, REFRIGERATED
                allergens TEXT NOT NULL DEFAULT 'None',
                handling_notes TEXT,
                cooked_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'POSTED',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pickups (
                id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES food_listings(id),
                receiver_id TEXT NOT NULL REFERENCES receivers(id),
                volunteer_name TEXT NOT NULL,
                volunteer_phone TEXT NOT NULL,
                vehicle_type TEXT NOT NULL DEFAULT 'Auto/Van', -- BIKE, AUTO, VAN
                claimed_at TEXT NOT NULL,
                collected_at TEXT,
                delivered_at TEXT,
                notes TEXT,
                UNIQUE(listing_id)
            );

            CREATE INDEX IF NOT EXISTS idx_listings_status ON food_listings(status);
            CREATE INDEX IF NOT EXISTS idx_listings_expires ON food_listings(expires_at);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pickups_listing ON pickups(listing_id);
            CREATE INDEX IF NOT EXISTS idx_listings_donor ON food_listings(donor_id);
            CREATE INDEX IF NOT EXISTS idx_pickups_receiver ON pickups(receiver_id);
            CREATE INDEX IF NOT EXISTS idx_listings_status_expires ON food_listings(status, expires_at);

            CREATE TABLE IF NOT EXISTS tax_certificates (
                id TEXT PRIMARY KEY,
                certificate_number TEXT UNIQUE NOT NULL,
                registration_order TEXT NOT NULL,
                donor_id TEXT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
                listing_id TEXT REFERENCES food_listings(id) ON DELETE CASCADE,
                donor_name TEXT NOT NULL,
                donor_pan TEXT NOT NULL,
                donor_address TEXT NOT NULL,
                food_name TEXT NOT NULL,
                quantity_kg REAL NOT NULL,
                quantity_meals INTEGER NOT NULL,
                fmv_rate_per_plate REAL NOT NULL,
                gross_salvage_valuation REAL NOT NULL,
                eligible_80g_deduction REAL NOT NULL,
                projected_corporate_tax_savings REAL NOT NULL,
                esg_co2e_offset_kg REAL NOT NULL,
                ca_name TEXT NOT NULL,
                ca_firm TEXT NOT NULL,
                icai_reg_no TEXT NOT NULL,
                udin TEXT NOT NULL,
                qr_verification_url TEXT NOT NULL,
                verification_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS shelter_intakes (
                id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
                receiver_id TEXT NOT NULL REFERENCES receivers(id) ON DELETE CASCADE,
                volunteer_name TEXT NOT NULL,
                arrived_at TEXT NOT NULL,
                intake_temp_c REAL NOT NULL,
                meals_accepted INTEGER NOT NULL,
                fssai_compliance_status TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tax_certs_donor ON tax_certificates(donor_id);
            CREATE INDEX IF NOT EXISTS idx_tax_certs_listing ON tax_certificates(listing_id);
            CREATE INDEX IF NOT EXISTS idx_shelter_intakes_listing ON shelter_intakes(listing_id);
            CREATE INDEX IF NOT EXISTS idx_shelter_intakes_receiver ON shelter_intakes(receiver_id);
            """
        )

        # Migrate existing pickups table if created without UNIQUE constraint
        pickups_sql = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='pickups'").fetchone()
        if pickups_sql and "UNIQUE" not in pickups_sql[0]:
            conn.execute("DROP INDEX IF EXISTS idx_pickups_listing")
            conn.execute("ALTER TABLE pickups RENAME TO pickups_old")
            conn.execute(
                """
                CREATE TABLE pickups (
                    id TEXT PRIMARY KEY,
                    listing_id TEXT NOT NULL REFERENCES food_listings(id),
                    receiver_id TEXT NOT NULL REFERENCES receivers(id),
                    volunteer_name TEXT NOT NULL,
                    volunteer_phone TEXT NOT NULL,
                    vehicle_type TEXT NOT NULL DEFAULT 'Auto/Van',
                    claimed_at TEXT NOT NULL,
                    collected_at TEXT,
                    delivered_at TEXT,
                    notes TEXT,
                    UNIQUE(listing_id)
                )
                """
            )
            conn.execute(
                """
                INSERT INTO pickups (id, listing_id, receiver_id, volunteer_name, volunteer_phone, vehicle_type, claimed_at, collected_at, delivered_at, notes)
                SELECT id, listing_id, receiver_id, volunteer_name, volunteer_phone, vehicle_type, claimed_at, collected_at, delivered_at, notes
                FROM pickups_old
                """
            )
            conn.execute("DROP TABLE pickups_old")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_pickups_listing ON pickups(listing_id)")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def seed_data(force: bool = False) -> dict:
    conn = get_connection()
    try:
        count = conn.execute("SELECT COUNT(*) FROM donors").fetchone()[0]
        if count > 0 and not force:
            return {"status": "already_seeded", "message": "Database already contains data."}

        conn.execute("DELETE FROM shelter_intakes")
        conn.execute("DELETE FROM tax_certificates")
        conn.execute("DELETE FROM pickups")
        conn.execute("DELETE FROM food_listings")
        conn.execute("DELETE FROM receivers")
        conn.execute("DELETE FROM donors")

        now = utc_now()

        # Seed Donors (Bengaluru coordinates)
        donors = [
            (
                "d1",
                "The Grand Amber Banquet Hall",
                "WEDDING_VENUE",
                "Suresh R.",
                "+91 98450 11234",
                "100 Feet Rd, Indiranagar",
                "Bengaluru",
                12.9716,
                77.6412,
                (now - timedelta(days=10)).isoformat(),
            ),
            (
                "d2",
                "TechPark Central Food Court",
                "CATERER",
                "Amit Sharma",
                "+91 98860 55678",
                "EPIP Zone, Whitefield",
                "Bengaluru",
                12.9698,
                77.7500,
                (now - timedelta(days=15)).isoformat(),
            ),
            (
                "d3",
                "Paradise Biryani & Coastal Grill",
                "RESTAURANT",
                "Farhan Khan",
                "+91 97410 99887",
                "5th Block, Koramangala",
                "Bengaluru",
                12.9352,
                77.6245,
                (now - timedelta(days=5)).isoformat(),
            ),
            (
                "d4",
                "PES University Campus Mess",
                "HOSTEL_MESS",
                "Nagaraj Murthy",
                "+91 94480 33221",
                "Outer Ring Rd, Banashankari",
                "Bengaluru",
                12.9345,
                77.5345,
                (now - timedelta(days=20)).isoformat(),
            ),
        ]
        conn.executemany(
            """
            INSERT INTO donors (id, name, donor_type, contact_name, contact_phone, address, city, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            donors,
        )

        # Seed Receivers (NGOs, Shelters)
        receivers = [
            (
                "r1",
                "Robin Hood Army - Indiranagar Hub",
                "NGO",
                "Neha Sen",
                "+91 98200 44556",
                150,
                "Double Road, Indiranagar",
                "Bengaluru",
                12.9783,
                77.6408,
                now.isoformat(),
            ),
            (
                "r2",
                "City Hope Homeless Shelter",
                "SHELTER",
                "Fr. Joseph Mathew",
                "+91 94490 77112",
                100,
                "8th Main, Koramangala 4th Block",
                "Bengaluru",
                12.9380,
                77.6180,
                now.isoformat(),
            ),
            (
                "r3",
                "Whitefield Community Kitchen",
                "COMMUNITY_KITCHEN",
                "Lakshmi Narayanan",
                "+91 99001 88334",
                200,
                "Hope Farm Junction, Whitefield",
                "Bengaluru",
                12.9700,
                77.7400,
                now.isoformat(),
            ),
            (
                "r4",
                "Aasra Night Shelter",
                "SHELTER",
                "Ramesh Gowda",
                "+91 98800 12345",
                80,
                "BSK 3rd Stage, Banashankari",
                "Bengaluru",
                12.9400,
                77.5400,
                now.isoformat(),
            ),
        ]
        conn.executemany(
            """
            INSERT INTO receivers (id, name, receiver_type, contact_name, contact_phone, capacity_meals, address, city, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            receivers,
        )

        # Seed Listings with realistic timestamps
        # Listing 1: Fresh Wedding Surplus (POSTED - urgent, expires in 2.5 hours)
        l1_cooked = now - timedelta(hours=1)
        l1_expires = now + timedelta(hours=2.5)
        # Listing 2: TechPark Lunch Surplus (CLAIMED - volunteer on way)
        l2_cooked = now - timedelta(hours=2)
        l2_expires = now + timedelta(hours=2)
        # Listing 3: Paradise Biryani (DELIVERED earlier today)
        l3_cooked = now - timedelta(hours=8)
        l3_expires = now - timedelta(hours=3)
        # Listing 4: Hostel Dinner Pulao (DELIVERED yesterday)
        l4_cooked = now - timedelta(days=1, hours=2)
        l4_expires = now - timedelta(days=1)

        listings = [
            (
                "l1",
                "d1",
                "Royal Hyderabadi Veg Pulao & Paneer Makhani",
                "VEG",
                120,
                55.0,
                "HOT",
                "Dairy (Paneer)",
                "Hot thermal containers sealed with foil. Consume within 3 hours.",
                l1_cooked.isoformat(),
                l1_expires.isoformat(),
                STATUS_POSTED,
                l1_cooked.isoformat(),
            ),
            (
                "l2",
                "d2",
                "Wholesome Roti, Dal Tadka & Mix Veg Sabzi",
                "VEG",
                80,
                36.0,
                "HOT",
                "Gluten (Wheat)",
                "Stainless steel catering trays. Safe temperature maintained above 65°C.",
                l2_cooked.isoformat(),
                l2_expires.isoformat(),
                STATUS_CLAIMED,
                l2_cooked.isoformat(),
            ),
            (
                "l3",
                "d3",
                "Hyderabadi Chicken Dum Biryani & Mirchi Salan",
                "NON_VEG",
                60,
                32.0,
                "HOT",
                "None",
                "Prepared for dinner event, excess unserved portions strictly kept hot.",
                l3_cooked.isoformat(),
                l3_expires.isoformat(),
                STATUS_DELIVERED,
                l3_cooked.isoformat(),
            ),
            (
                "l4",
                "d4",
                "South Indian Lemon Rice & Sambar",
                "VEG",
                140,
                65.0,
                "HOT",
                "Mustard seeds",
                "Hostel evening batch, freshly prepared and covered.",
                l4_cooked.isoformat(),
                l4_expires.isoformat(),
                STATUS_DELIVERED,
                l4_cooked.isoformat(),
            ),
        ]
        conn.executemany(
            """
            INSERT INTO food_listings (id, donor_id, food_name, food_category, quantity_meals, quantity_kg, storage_type, allergens, handling_notes, cooked_at, expires_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            listings,
        )

        # Seed Pickups for l2 (CLAIMED) and l3, l4 (DELIVERED)
        pickups = [
            (
                "p1",
                "l2",
                "r3",
                "Vikram Adiga",
                "+91 99112 33445",
                "Maruti Eeco Cargo Van",
                (now - timedelta(minutes=45)).isoformat(),
                None,
                None,
                "Driver dispatched from Whitefield hub, ETA 15 mins.",
            ),
            (
                "p2",
                "l3",
                "r2",
                "Santosh Kumar",
                "+91 98441 22334",
                "Electric Three-Wheeler",
                (now - timedelta(hours=6)).isoformat(),
                (now - timedelta(hours=5, minutes=30)).isoformat(),
                (now - timedelta(hours=4, minutes=45)).isoformat(),
                "Delivered to Koramangala homeless shelter, 60 people fed dinner.",
            ),
            (
                "p3",
                "l4",
                "r4",
                "Kavitha R.",
                "+91 97330 88990",
                "Delivery Van",
                (now - timedelta(days=1, hours=1)).isoformat(),
                (now - timedelta(days=1, minutes=30)).isoformat(),
                (now - timedelta(days=1)).isoformat(),
                "Delivered to night shelter, warm meal served to 140 night workers.",
            ),
        ]
        conn.executemany(
            """
            INSERT INTO pickups (id, listing_id, receiver_id, volunteer_name, volunteer_phone, vehicle_type, claimed_at, collected_at, delivered_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            pickups,
        )

        # Seed initial verified shelter intake records for delivered rescues (l3, l4)
        intakes = [
            (
                "in1",
                "l3",
                "r2",
                "Santosh Kumar",
                (now - timedelta(hours=4, minutes=45)).isoformat(),
                68.4,
                60,
                "HOT_HOLD_COMPLIANT",
                "Delivered to Koramangala homeless shelter; core temp 68.4°C verified compliant.",
                (now - timedelta(hours=4, minutes=45)).isoformat(),
            ),
            (
                "in2",
                "l4",
                "r4",
                "Kavitha R.",
                (now - timedelta(days=1)).isoformat(),
                67.2,
                140,
                "HOT_HOLD_COMPLIANT",
                "Night shelter intake complete; core temp 67.2°C verified compliant.",
                (now - timedelta(days=1)).isoformat(),
            ),
        ]
        conn.executemany(
            """
            INSERT INTO shelter_intakes (id, listing_id, receiver_id, volunteer_name, arrived_at, intake_temp_c, meals_accepted, fssai_compliance_status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            intakes,
        )

        # Seed initial Section 80G tax certificates for donors
        tax_certs = [
            (
                "tc0",
                "80G-BLR-2026-D10001",
                "CIT(E)/BLR/80G/2021-22/AABCS1234F/01",
                "d1",
                "l1",
                "The Grand Amber Banquet Hall",
                "AABCS4961K",
                "No. 42, Palace Road, Vasanth Nagar, Bengaluru",
                "Royal Hyderabadi Veg Pulao & Paneer Makhani",
                55.0,
                120,
                65.0,
                7800.0,
                3900.0,
                1014.0,
                137.5,
                "CA Rajeshwari Sundaram, FCA",
                "R. Sundaram & Associates, Chartered Accountants",
                "021948S",
                "26021948AAAAAA1001",
                "/api/tax/verify/tc0",
                "ceb557ec36f80ea955deb3a1c001bd06377e8f48fedefdb7f8553f9ab9e5e62a",
                (now - timedelta(hours=5)).isoformat(),
            ),
            (
                "tc1",
                "80G-BLR-2026-L30001",
                "CIT(E)/BLR/80G/2021-22/AABCS1234F/01",
                "d3",
                "l3",
                "Paradise Biryani & Coastal Grill",
                "AABCS9988K",
                "5th Block, Koramangala, Bengaluru",
                "Hyderabadi Chicken Dum Biryani & Mirchi Salan",
                32.0,
                60,
                65.0,
                3900.0,
                1950.0,
                507.0,
                80.0,
                "CA Rajeshwari Sundaram, FCA",
                "R. Sundaram & Associates, Chartered Accountants",
                "021948S",
                "26021948AAAAAA1968",
                "/api/tax/verify/tc1",
                "3e3b03b4d567cf8953a38946e4e981fe385599e662d1ad87ef77b4e02a2cd492",
                (now - timedelta(hours=4)).isoformat(),
            ),
        ]
        conn.executemany(
            """
            INSERT INTO tax_certificates (id, certificate_number, registration_order, donor_id, listing_id, donor_name, donor_pan, donor_address, food_name, quantity_kg, quantity_meals, fmv_rate_per_plate, gross_salvage_valuation, eligible_80g_deduction, projected_corporate_tax_savings, esg_co2e_offset_kg, ca_name, ca_firm, icai_reg_no, udin, qr_verification_url, verification_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            tax_certs,
        )

        conn.commit()
        try:
            from app.cache import cache_service
            cache_service.invalidate_tag("impact")
            cache_service.invalidate_tag("directory")
        except Exception:
            pass
        return {"status": "seeded", "donors": len(donors), "receivers": len(receivers), "listings": len(listings)}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
