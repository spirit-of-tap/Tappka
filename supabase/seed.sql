-- Seed data for Tappka database
-- This file contains initial data inserts that should be run after migrations

-- ============================================
-- SEED DATA - ROOMS
-- ============================================

INSERT INTO rooms (code, name, description, available_days, can_have_ts) VALUES
    ('d126', 'D126', 'Přední Koučovačka', NULL, true),
    ('d132', 'D132', 'Zadní Koučovačka', NULL, true),
    ('d226', 'D226', 'Horní Koučovačka "Kaamos" místnost', NULL, true),
    ('d127', 'D127 - Tichá místnost', 'Přední pravá malá místnost se zvedacímy stoly a gaučíkem', NULL, false),
    ('d129', 'D129 - Reprezentační místnost', 'Zadní pravá malá místnost', NULL, false),
    ('d107', 'D107', 'Dostupná pouze ve středu. První středa v měsíci: Houston Calling 9-12.', ARRAY[3], false);

