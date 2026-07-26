-- ============================================================================
-- Seed Script: Create Teams and Profiles from Kontakty CSV
-- Generated for Tappka application
-- 
-- This script is idempotent - safe to run multiple times.
-- Teams and profiles with existing names/emails will be skipped.
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TEAMS
-- ============================================================================
-- Teams are organized by cohort year (starting year of the program)
-- year field represents the cohort number (1 = first cohort from 2019, etc.)

-- 2019 cohort (year 1)
INSERT INTO teams (name, year)
SELECT 'Acconditor', 1
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Acconditor');

INSERT INTO teams (name, year)
SELECT 'Invitap', 1
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Invitap');

-- 2020 cohort (year 2)
INSERT INTO teams (name, year)
SELECT 'Tiimeri', 2
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Tiimeri');

INSERT INTO teams (name, year)
SELECT 'Teamly', 2
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Teamly');

-- 2021 cohort (year 3)
INSERT INTO teams (name, year)
SELECT 'JBS - cooperative', 3
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'JBS - cooperative');

INSERT INTO teams (name, year)
SELECT 'GimiTimi', 3
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'GimiTimi');

-- 2022 cohort (year 4)
INSERT INTO teams (name, year)
SELECT 'Luotapa', 4
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Luotapa');

INSERT INTO teams (name, year)
SELECT 'KAAMOS', 4
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'KAAMOS');

-- 2023 cohort (year 5)
INSERT INTO teams (name, year)
SELECT 'UniWave', 5
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'UniWave');

INSERT INTO teams (name, year)
SELECT 'Weam', 5
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Weam');

-- 2024 cohort (year 6)
INSERT INTO teams (name, year)
SELECT 'PAVIAAN', 6
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'PAVIAAN');

INSERT INTO teams (name, year)
SELECT 'BASED', 6
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'BASED');

-- 2025 cohort (year 7)
INSERT INTO teams (name, year)
SELECT 'TULI', 7
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'TULI');

INSERT INTO teams (name, year)
SELECT 'TIMACE', 7
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'TIMACE');

-- Coaches (no year)
INSERT INTO teams (name, year)
SELECT 'Kouči', NULL
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Kouči');

-- ============================================================================
-- PART 2: CREATE PROFILES
-- ============================================================================
-- Only profiles with valid school emails (@studenti.czu.cz or @pef.czu.cz) are included.
-- Duplicate entries are resolved by preferring coach entries over student entries.
-- Role is 'coach' for Kouči team members, 'student' for everyone else.

-- ============================================================================
-- UniWave team (2023 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Filip Hlavatý', 'xhlaf005@studenti.czu.cz', '732335143', 'filip242hlavaty@gmail.com', '2003-02-24'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhlaf005@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Aleš Chytil', 'xchya004@studenti.czu.cz', '736524217', 'ales.chytil@post.cz', '2002-09-10'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xchya004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Andrej Rožnov', 'xroza010@studenti.czu.cz', '733658373', 'drupiere@gmail.com', '1989-05-16'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xroza010@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Eliška Popeláková', 'xpope008@studenti.czu.cz', '604802007', 'popelakova.eli@gmail.com', '2003-11-27'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpope008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Alžběta Navrátilová', 'xnava009@studenti.czu.cz', '732909508', 'alzbetanav@gmail.com', '2001-01-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xnava009@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Marie Kozáková', 'xkozm043@studenti.czu.cz', '732203709', 'm.kozakova256@gmail.com', '2004-08-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkozm043@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Pavla Vaňková', 'xvanp024@studenti.czu.cz', '731965345', 'pavla.vankova4@gmail.com', '2000-08-13'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvanp024@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Dominika Šimková', 'xsimd031@studenti.czu.cz', '723424911', 'dominikasimkovaa@gmail.com', '2003-09-16'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsimd031@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Laura Stejskalová', 'xstel061@studenti.czu.cz', '777525265', 'lalaura1928@gmail.com', '2003-03-25'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xstel061@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Elen Kejdová', 'xkeje003@studenti.czu.cz', '602829095', 'ekejdova@gmail.com', '2004-05-02'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkeje003@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Tomáš Sedláček', 'xsedt016@studenti.czu.cz', '606070586', 'tomas.sedlacek.ip@gmail.com', '2003-05-17'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsedt016@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Štěpán Felčárek', 'xfels002@studenti.czu.cz', '604468326', 'stepanfelcarek333@gmail.com', '2004-07-21'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xfels002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Štěpán Venc', 'xvens008@studenti.czu.cz', '603588735', 'stepan.venc@gmail.com', '2004-05-14'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvens008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Šimon Pavek', 'xpavs009@studenti.czu.cz', '725985405', 'simonpavek03@seznam.cz', '2003-11-27'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpavs009@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Václav Bajko', 'xbajv004@studenti.czu.cz', '728473215', 'vaclavbajko36@gmail.com', '2004-06-26'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbajv004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Tereza Horáková', 'xhort028@studenti.czu.cz', '604637738', NULL, '2004-05-05'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'UniWave')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhort028@studenti.czu.cz');

-- ============================================================================
-- Weam team (2023 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jan Machatý', 'xmacj083@studenti.czu.cz', '734606801', 'janmachaty03@gmail.com', '2003-07-24'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmacj083@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Adam Zika', 'xzika008@studenti.czu.cz', '605317178', 'adam.zika007@gmail.com', '2004-08-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xzika008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Andrea Obersteinová', 'xobea003@studenti.czu.cz', '722507083', 'ajaobersteinova@gmail.com', '2004-04-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xobea003@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jakub Hájek', 'hajekjakub@pef.czu.cz', '721964682', 'jhajek95@gmail.com', '2004-06-23'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'hajekjakub@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Adam Ryba', 'xryba010@studenti.czu.cz', '723604164', 'adam.rybaa@gmail.com', '2002-09-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xryba010@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Barbora Kyptová', 'xkypb001@studenti.czu.cz', '736276834', 'barca.kyptova@gmail.com', '2004-02-11'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkypb001@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matouš Krčmář', 'xkrcm015@studenti.czu.cz', '601100552', 'matouskrcmar@gmail.com', '2003-06-25'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkrcm015@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matyáš Macek', 'xmacm080@studenti.czu.cz', '606767247', 'matym.macek@seznam.cz', '2004-05-05'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmacm080@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Lenka Štěrbová', 'xstel062@studenti.czu.cz', '702625122', 'lenasterbovaa@gmail.com', '2003-10-03'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xstel062@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Vojtěch Krcho', 'xkrcv004@studenti.czu.cz', '737673433', 'vojtechkrchovk@gmail.com', '2004-04-02'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkrcv004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Radim Sobotka', 'xsobr005@studenti.czu.cz', '728165135', '1.radim.sobotka@gmail.com', '2003-12-30'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsobr005@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Ondřej Bleha', 'xbleo002@studenti.czu.cz', '607772201', 'bleha.ondrej@gmail.com', '2003-06-01'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbleo002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Katrin Kryštofová', 'xkryk005@studenti.czu.cz', '730104920', 'katrinka.krystofova@gmail.com', '2004-04-19'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkryk005@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Lukáš Voráč', 'xvorl011@studenti.czu.cz', '725841190', 'vorac.luky@gmail.com', '2004-02-13'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvorl011@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Kateřina Ostřížková', 'xostk002@studenti.czu.cz', '721004597', 'katerina.ostrizkova@email.cz', '2003-11-12'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xostk002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Lenka Melková', 'xmell012@studenti.czu.cz', '730686471', 'lenickamelkova@gmail.com', '2003-12-07'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmell012@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Michael Petschat', 'xpetm093@studenti.czu.cz', '737763437', 'petschatm@gmail.com', '2003-10-17'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpetm093@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matyáš Bronček', 'xbrom042@studenti.czu.cz', '773090694', 'matyas.broncek@gmail.com', '2003-04-01'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'Weam')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbrom042@studenti.czu.cz');

-- ============================================================================
-- PAVIAAN team (2024 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Adéla Maráková', 'xmara152@studenti.czu.cz', '722227136', 'adelamarakova119@gmail.com', '2004-11-09'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmara152@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'David Semanišin', 'xsemd016@studenti.czu.cz', '774436956', 'semanisin.d@gmail.com', '2003-08-06'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsemd016@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Eliška Pohlová', 'xpohe002@studenti.czu.cz', '776408052', 'eli.pohlova@gmail.com', '2003-03-03'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpohe002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Alexander Hill', 'xhila003@studenti.czu.cz', '607468784', 'hillalexwork@gmail.com', '2005-06-12'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhila003@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jan Hospodár', 'xhosj017@studenti.czu.cz', '737060814', 'janhospodar111104@gmail.com', '2004-11-11'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhosj017@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Anastázie Zvoníková', 'xzvoa002@studenti.czu.cz', '734647086', 'anastazie.zv@gmail.com', '2004-10-09'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xzvoa002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Adam Dalecký', 'xdala003@studenti.czu.cz', '606028051', 'adam.dalecky@email.cz', '2005-01-01'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xdala003@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jan Čech', 'xcecj005@studenti.czu.cz', '607400747', 'cechjanskola@gmail.com', '2004-11-08'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xcecj005@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Ondřej Schlossar', 'xscho008@studenti.czu.cz', '725888319', 'o.schlossar@seznam.cz', '2003-12-12'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xscho008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matyáš Sýkora', 'xsykm012@studenti.czu.cz', '606199002', 'syki2004@gmail.com', '2004-11-19'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsykm012@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Vojtěch Kozák', 'kozakv@pef.czu.cz', '722778866', 'vojtakozak.production@gmail.com', '2001-09-25'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'kozakv@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Niklas Kovanda', 'xkovn008@studenti.czu.cz', '732285653', 'niklas.kovanda@gmail.com', '2004-09-18'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkovn008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Lea Maria Vrzáčková', 'xvrzl002@studenti.czu.cz', '733221601', 'lea.vrzackova@gmail.com', '2005-07-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvrzl002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Mikuláš Procházka', 'xprom153@studenti.czu.cz', '607663445', 'mikproch21@gmail.com', '2004-07-03'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xprom153@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Vojtěch Maňour', 'xmanv007@studenti.czu.cz', '775345116', 'vojtech.manour@gmail.com', '2005-03-11'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmanv007@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Tereza Lendvaiová', 'xlent001@studenti.czu.cz', '777336151', 'tereza.lendvai@gmail.com', '2004-09-06'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'PAVIAAN')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xlent001@studenti.czu.cz');

-- ============================================================================
-- BASED team (2024 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matěj Červinka', 'xcerm251@studenti.czu.cz', '723969031', NULL, '2005-01-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xcerm251@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Michael Bražina', 'xbram065@studenti.czu.cz', '725948785', 'brazina.11@gmail.com', '2004-03-12'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbram065@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'František Marghold', 'xmarf020@studenti.czu.cz', '739246947', 'fmarghold@gmail.com', '2004-01-08'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmarf020@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jonatan Petr', 'xpetj076@studenti.czu.cz', '733737335', 'jonatan.petr@gmail.com', '2004-10-19'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpetj076@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jana Hvozdová', 'xhvoj001@studenti.czu.cz', '607513750', NULL, '2005-04-14'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhvoj001@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Dan Lipový', 'xlipd008@studenti.czu.cz', '776200251', NULL, '2004-11-03'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xlipd008@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Minh Anh Pham', 'xpham004@studenti.czu.cz', '776343198', 'pham.anickaa@gmail.com', '2004-12-21'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpham004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Filip Drexner', 'xdref002@studenti.czu.cz', '775681544', 'flip00156@gmail.com', '2004-02-11'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xdref002@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jakub David', 'xdavj012@studenti.czu.cz', '737114462', NULL, '2005-06-07'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xdavj012@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Šimon Kořínek', 'xkors022@studenti.czu.cz', '601026466', 'simon.korinek123@gmail.com', '2004-10-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkors022@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'William Fleetwood', 'xflew001@studenti.czu.cz', '725712354', 'williamgfleetwood@gmail.com', '2005-06-27'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xflew001@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Petr Hofman', 'xhofp004@studenti.czu.cz', '604752628', 'p.hofman258@gmail.com', '2003-11-05'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhofp004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Nikolas Kalaidzidis', 'xkaln019@studenti.czu.cz', '608888944', 'nikoscz1546@gmail.com', '2002-07-15'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'BASED')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkaln019@studenti.czu.cz');

-- ============================================================================
-- TULI team (2025 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Marko Petrović', 'xpetm151@studenti.czu.cz', '608444885', 'markopetrovic.mp75@gmail.com', '2005-07-30'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpetm151@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'David Izák', 'xizad001@studenti.czu.cz', '775107751', 'dadakizakovitch@gmail.com', '2005-11-04'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xizad001@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Aneta Kmetíková', 'xkmea004@studenti.czu.cz', '608966953', 'anetakmetikova02@gmail.com', '2002-11-05'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkmea004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Julie Holá', 'xholj080@studenti.czu.cz', '777902646', 'juliehola6@gmail.com', '2006-03-31'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xholj080@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matěj Hrnčíř', 'xhrnm006@studenti.czu.cz', '732468703', 'matej.hrncir.2@gmail.com', '2006-03-24'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhrnm006@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Dominika Poláková', 'xpold029@studenti.czu.cz', '777944695', 'polakovadominika5@gmail.com', '2005-11-15'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpold029@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Annabela Šimková', 'xsima046@studenti.czu.cz', '608026342', 'xxsimkova@gmail.com', '2006-05-09'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsima046@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Ondřej Kulhavý', 'xkulo007@studenti.czu.cz', '774246513', 'okulhav@gmail.com', '2005-05-26'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xkulo007@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Anna Pokorná', 'xpoka022@studenti.czu.cz', '774318390', 'anickapokorna06@gmail.com', '2006-01-25'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xpoka022@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Marie Machytková', 'xmacm149@studenti.czu.cz', '731572402', 'mmachytkova2004@gmail.com', '2004-09-03'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmacm149@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matyáš Hodek', 'xhodm018@studenti.czu.cz', '730945000', 'matyhodek@gmail.com', '2005-06-28'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhodm018@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Veronika Honsová', 'xhonv007@studenti.czu.cz', '774905990', 'verunkah1478@gmail.com', '2005-11-28'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhonv007@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jan Chmelík', 'xchmj013@studenti.czu.cz', '774302399', 'chmelik338@gmail.com', '2005-11-11'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xchmj013@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'David Štantejský', 'xstad039@studenti.czu.cz', '602516190', 'd.stantejsky@gmail.com', '2006-08-10'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xstad039@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Daniel Havran', 'xhavd026@studenti.czu.cz', '+421724384819', 'vohnoutdan@gmail.com', NULL, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xhavd026@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matěj Vrbas', 'xvrbm014@studenti.czu.cz', '773113692', 'matejvrbas@gmail.com', '2005-06-20'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvrbm014@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Laura Šimůnková', 'xtepl002@studenti.czu.cz', '734181844', 'laurasimunkova1@gmail.com', '2005-02-26'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TULI')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xtepl002@studenti.czu.cz');

-- ============================================================================
-- TIMACE team (2025 cohort)
-- ============================================================================

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Klára Matějíčková', 'xmatk047@studenti.czu.cz', '605390228', 'klarimatejickova@gmail.com', '2006-08-10'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xmatk047@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Vojtěch Šádek', 'xsadv003@studenti.czu.cz', '739506093', 'vojtechsadek27@gmail.com', '2006-05-23'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsadv003@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Annika Šumanová', 'xsuma006@studenti.czu.cz', '736520211', 'annika.sumanova@gmail.com', '2005-10-31'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsuma006@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Matyáš Brůna', 'xbrum022@studenti.czu.cz', '604620011', 'matyasbruna05@gmail.com', '2005-01-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbrum022@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Anna Gina Boková', 'xboka004@studenti.czu.cz', '722035840', 'anna.gina.bokova@gmail.com', '2006-06-09'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xboka004@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Dominik Slavík', 'xslad034@studenti.czu.cz', '602750402', 'slavikdominik6@gmail.com', '2005-11-30'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xslad034@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Sofiya Ryashko', 'xryas001@studenti.czu.cz', '776255311', 'sofiya.ryashko@gmail.com', '2005-10-22'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xryas001@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Anna Carbolová', 'xcara017@studenti.czu.cz', '605972143', 'ana.carbolova@gmail.com', '2005-09-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xcara017@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Barbora Tomášová', 'xtomb012@studenti.czu.cz', '731862055', 'bara.tomasova06@gmail.com', '2006-05-24'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xtomb012@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Tereza Brabcová', 'xbrat018@studenti.czu.cz', '778140128', 'brabcovaterezka@gmail.com', '2003-09-17'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbrat018@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Albert Levíček', 'xleva009@studenti.czu.cz', '605914205', 'albert.levicek@gmail.com', '2006-01-19'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xleva009@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Aneta Brodská', 'xbroa026@studenti.czu.cz', '739159300', 'aneta.brodska@icloud.com', '2006-01-29'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbroa026@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jáchym Bronček', 'xbroj042@studenti.czu.cz', '775602617', 'jachym.broncek@gmail.com', '2005-07-22'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xbroj042@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Natálie Minuthová', 'xminn007@studenti.czu.cz', '735281088', 'minutnaty@gmail.com', '2005-12-08'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xminn007@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Vojtěch Svatek', 'xsvav026@studenti.czu.cz', '773171588', 'vojsvatek@gmail.com', '2003-07-23'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xsvav026@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Tomáš Protiva', 'xprot040@studenti.czu.cz', '735120530', 'protitom@gmail.com', '2006-05-23'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xprot040@studenti.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Daniel Vlček', 'xvlcd015@studenti.czu.cz', '604841593', 'daniel.612.vlcek@gmail.com', '2006-05-31'::date, 'student'::profile_role, (SELECT id FROM teams WHERE name = 'TIMACE')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'xvlcd015@studenti.czu.cz');

-- ============================================================================
-- Kouči team (Coaches) - only those with valid @pef.czu.cz emails
-- ============================================================================

-- Jonáš Plichta - appears as both student and coach, using coach entry
INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Jonáš Plichta', 'plichta@pef.czu.cz', '606358931', 'plichtajonas@gmail.com', '1999-12-16'::date, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'plichta@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Petr Oliver', 'oliver@pef.czu.cz', NULL, NULL, NULL, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'oliver@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Petr Švalb', 'svalb@pef.czu.cz', '724590144', 'petr.svalb@gmail.com', NULL, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'svalb@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Zdeněk Lustig', 'lustigz@pef.czu.cz', '603551062', NULL, NULL, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'lustigz@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Monika Košuličová', 'kosulicova@pef.czu.cz', NULL, NULL, NULL, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'kosulicova@pef.czu.cz');

INSERT INTO profiles (name, work_email, phone_number, personal_email, date_of_birth, role, team_id)
SELECT 'Gabriela Dlouhá', 'gdlouha@pef.czu.cz', '730842142', NULL, NULL, 'coach'::profile_role, (SELECT id FROM teams WHERE name = 'Kouči')
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE work_email = 'gdlouha@pef.czu.cz');

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This script creates:
-- - 15 teams (Acconditor, Invitap, Tiimeri, Teamly, JBS - cooperative, GimiTimi,
--   Luotapa, KAAMOS, UniWave, Weam, PAVIAAN, BASED, TULI, TIMACE, Kouči)
-- - 97 profiles with valid school emails (@studenti.czu.cz or @pef.czu.cz)
--
-- Profiles from older cohorts (2019-2022) without school emails are NOT included
-- because the work_email field has a CHECK constraint requiring valid domains.
--
-- Coaches without @pef.czu.cz email (Pavel Koláček with @rektorat.czu.cz, etc.)
-- are also excluded due to the CHECK constraint.
--
-- To run this script via psql:
-- psql -h <host> -U <user> -d <database> -f scripts/seed-profiles.sql
-- ============================================================================
