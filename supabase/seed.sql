-- Seed data for Tappka database
-- This file contains initial data inserts that should be run after migrations

-- ============================================
-- SEED DATA - SYSTEM PROFILE
-- ============================================
-- Bootstrap profile used to attribute system-seeded rows (e.g. rooms) that
-- have no real authenticated creator. Not linked to a user account.

INSERT INTO profiles (name, work_email, role) VALUES
    ('System', 'admin@studenti.czu.cz', 'admin');

-- ============================================
-- SEED DATA - ROOMS
-- ============================================

INSERT INTO rooms (code, name, description, available_days, can_have_ts, created_by_profile_id, updated_by_profile_id)
SELECT code, name, description, available_days, can_have_ts, system_profile.id, system_profile.id
FROM (
    VALUES
        ('d126', 'D126', 'Přední Koučovačka', NULL::integer[], true),
        ('d132', 'D132', 'Zadní Koučovačka', NULL::integer[], true),
        ('d226', 'D226', 'Horní Koučovačka "Kaamos" místnost', NULL::integer[], true),
        ('d127', 'D127 - Tichá místnost', 'Přední pravá malá místnost se zvedacímy stoly a gaučíkem', NULL::integer[], false),
        ('d129', 'D129 - Reprezentační místnost', 'Zadní pravá malá místnost', NULL::integer[], false),
        ('d107', 'D107', 'Dostupná pouze ve středu. První středa v měsíci: Houston Calling 9-12.', ARRAY[3], false)
) AS seed_rooms(code, name, description, available_days, can_have_ts)
CROSS JOIN (
    SELECT id FROM profiles WHERE work_email = 'admin@studenti.czu.cz'
) AS system_profile;

