-- Custom SQL migration file, put your code below! --

-- Migration: seed Rocket Model reference content (14 processes, 71 statements).
-- Source: Tiimiakatemia Rocket Model checklist (Czech statements, English
-- process titles). Statements are phrased team-wise but evaluated per person.
-- Idempotent (NOT EXISTS guards) so re-runs never duplicate rows. Individual
-- and team check states always default to unchecked — the app owns those.
-- Future text changes go in new migrations, never by editing this file.

INSERT INTO public.rocket_categories (code, title, order_index)
SELECT v.code, v.title, v.order_index
FROM (VALUES
  ('Y1', 'Y1 - The process of Individual Learning', 0),
  ('Y2', 'Y2 - The Process of Team Learning', 1),
  ('Y3', 'Y3 - The Process of Team-Company Learning', 2),
  ('J1', 'J1 - The Process of Creating Leading Thoughts', 3),
  ('J2', 'J2 - The Process of (Friend) Leadership', 4),
  ('I1', 'I1 - The Process of Innovation', 5),
  ('I2', 'I2 - The Process of Knowledge', 6),
  ('B1', 'B1 - The Process of Brand Management', 7),
  ('B2', 'B2 - The Process of Offerings', 8),
  ('A3', 'A3 - The Process of Potential Customers', 9),
  ('A2', 'A2 - The Process of Marketing', 10),
  ('A1', 'A1 - The Process of Customer Relationships', 11),
  ('FIN', 'The Process of Finances', 12),
  ('COACH', 'The Process of Team Coaching', 13)
) AS v(code, title, order_index)
WHERE NOT EXISTS (SELECT 1 FROM public.rocket_categories c WHERE c.code = v.code);

INSERT INTO public.rocket_items (category_id, order_index, text_cs)
SELECT c.id, v.ord, v.text_cs
FROM (VALUES
  ('Y1', 0, 'Každý člen týmu chápe proces individuálního vzdělávání, principy účení se v Tiimiakatemia a principy mentálních modelů.'),
  ('Y1', 1, 'Training sessions probíhají hladce a členové týmu chtějí být na nich přítomni. Každý člen týmu má docházku minimálně 80 % za semestr.'),
  ('Y1', 2, 'Každý člen týmu aktualizuje svůj Learning Contract alespoň 1x za semestr.'),
  ('Y1', 3, 'Každý člen týmu má svůj Reading Plan.'),
  ('Y1', 4, 'Každý člen týmu si vede Learning Diary.'),
  ('Y1', 5, 'Každý člen týmu pravidelně vyplňuje své individuální portfolio.'),
  ('Y1', 6, 'Na training session vedl tým dialog na základě esejí každého člena týmu o knize, kterou schválil kouč (např. Leinonen & Partanen & Palviainen: Team Academy: A True Story of a Community That Learns by Doing, Prashnig: Power of Diversity, Dryden & Vos: The Learning revolution, Csikszentmihalyi: Flow: The Psychology of Optimal Experience).'),
  ('Y2', 0, 'Naučili jsme se základy dialogu a ověřili na training session. Každý teampreneur napsal esej, která byla okomentována koučem, o knize Dialogue and the art of thinking together (Isaacs).'),
  ('Y2', 1, 'Spolupracujeme, a vytvořili jsme sdílený týmový projekt, který jsme dotáhli do konce. (např. prodávání vánočních stromků, dárkové balení..)'),
  ('Y2', 2, 'Každý teampreneur si provedl osobnostní test (např. Gallup) a společně jsme diskutovali nad výsledky.'),
  ('Y2', 3, 'Na training session tým vedl dialog na základě esejí každého člena týmu, o knize, kterou schválil kouč (např. 17. zákonů týmové spolupráce)'),
  ('Y3', 0, 'Rozumíme vizi, misi a hodnotám TAP.'),
  ('Y3', 1, 'Naše podnikání startuje, dokončili jsme první projekty, které vygenerovaly příjmy.'),
  ('Y3', 2, 'Jako indikátor používáme výnos, který tvoří alespoň 10 000 Kč na člověka za první ročník.'),
  ('Y3', 3, 'Na training session tým vedl dialog na základě esejí 4 členů týmu, o knize, kterou schválil kouč. Isaacson: Steve Jobs, Stone: Michelangelo nebo jiné knize schválené koučem'),
  ('Y3', 4, 'Tým společně absolvoval Cabin in The woods 1x za semestr.'),
  ('J1', 0, 'Každý z nás napsal esej na TAP leading thoughts. Poté jsme uspořádali training session, kde jsme na základě těchto esejí vedli dialog.'),
  ('J1', 1, 'Jako týmová společnost se účastníme Houston Calling a Rocket Days, které jdou ruku v ruce s hodnotami Tiimiakatemie.'),
  ('J1', 2, 'Na training session tým vedl dialog na základě esejí 4 členů týmu o knize, kterou schválil kouč (např. Chopra: The soul of leadership).'),
  ('J2', 0, 'Každý člen týmu napsal esej na knihu Friends leadership. Na training session jsme si ověřili, že rozumíme Friends leadership filozofii (výzvě procesu, inspiraci sdílené vize, umožnění ostatním jednat, modelování cesty, podpory srdce) a důležitosti usilí o osobní mistrovství.'),
  ('J2', 1, 'Každý člen týmu je součástí týmového projektu v rámci týmové společnosti.'),
  ('J2', 2, 'Rozumíme, že týmová společnost potřebuje kvalitní vedení (leadership). Máme management, který rozumí důležitosti Rocket Modelu ve vedení týmové společnosti.'),
  ('J2', 3, 'Rozumíme cílům týmové společnosti a jsme s nimi v souladu.'),
  ('J2', 4, 'Plánujeme společný týmový výjezd do zahraničí. Máme předběžný plán a rozpočet.'),
  ('J2', 5, 'Na training session vedl tým dialog na základě esejí 4 členů týmu o knize, kterou schválil kouč (např. Maxwell: 101, Heider: The Tao of Leadership).'),
  ('I1', 0, 'V naší týmové společnosti vyhledáváme nové zkušenosti a pravidelně o nich diskutujeme.'),
  ('I1', 1, 'Uspořádali jsme workshop/brainstorming pro zákazníka a vytvořili pro něj 50 nápadů. Ovládli jsme další inovační nástroj (např. Six Thinking Hats).'),
  ('I1', 2, 'Na training session vedl tým dialog na základě esejí 4 členů týmu, o knize, kterou schválil kouč (např. Johansson: The Medici Effect, Collins: Good to Great).'),
  ('I1', 3, 'V naší týmové společnosti panuje atmosféra důvěry.'),
  ('I2', 0, 'Každý člen týmu rozumí a praktikuje 4 různé typy znalostí podle Nonaka a Takeuchi.'),
  ('I2', 1, 'Aktivně používáme esej banku, sdílíme své poznatky a učíme se od druhých.'),
  ('I2', 2, 'Uspořádali jsme dva Birth Givingy pro naše zákazníky.'),
  ('I2', 3, 'Pochopili jsme, že týmová společnost je víc než pouhý tým.'),
  ('I2', 4, 'Aplikujeme všechnu teorii, kterou se naučíme, do byznysu naší firmy.'),
  ('I2', 5, 'Každý člen týmu má v průměru alespoň 8 crossů na konci 2. semestru.'),
  ('I2', 6, 'Na training session tým vedl dialog na základě eseje každého člena týmu o knize Nonaka a Takeuchi: The Knowledge-Creating Company.'),
  ('B1', 0, 'Rozumíme hodnotě, kterou vytváří značka Tiimiakatemia.'),
  ('B1', 1, 'Studovali jsme a rozumíme Tiimiakatemia Prague Brand manuálu.'),
  ('B1', 2, 'Používáme Tiimiakatemia Brand manuál k posílení našeho vlastního marketingu.'),
  ('B1', 3, 'Na training session vedl tým dialog na základě esejí 4 členů týmu o knize, kterou schválil kouč (např. Mooney & Rollins: The Open Brand, Ries & Trous: Positioning).'),
  ('B2', 0, 'Známe teorii a víme, jak vytvořit nabídku pro zákazníka.'),
  ('B2', 1, 'Za tým jsme vytvořili a podali 10 nabídek zákazníkům.'),
  ('B2', 2, 'Dokončili jsme alespoň 1 zákaznický projekt na každého člena na který jsme sepsali dokument shrnující naši zkušenost a reflexi. (viz. požadavky k předmětu).'),
  ('B2', 3, 'Na training session tým vedl dialog na základě esejí 4 členů týmu, o knize, kterou schválil kouč (např. Grane: Marketing for Entrepreneurs, Sewell: Customers for Life).'),
  ('A3', 0, 'Skrze zákaznické schůzky jsme pochopili, co můžeme nabídnout našemu zákazníkovi. Naše motto je: "Čím více schůzek, tím více kontraktů".'),
  ('A3', 1, 'Každý člen týmu si vytvořil plán zákaznických schůzek.'),
  ('A3', 2, 'Děláme Pre- a Postmotorola reporty z našich zákaznických schůzek. Po úspěšných schůzkách často posíláme reporty našim zákazníkům.'),
  ('A3', 3, 'Na konci 2. semestru má tým v průměru 20 zákaznických schůzek na člena.'),
  ('A3', 4, 'Na training session vedl tým dialog na základě esejí každého člena týmu, o knize, kterou schválil kouč (např. Quinn: Crowning the customer, Raphle & Raphel: Up the Loyalty Ladder).'),
  ('A2', 0, 'Na training session jsme udělali reflexi, jak v celé naší práci komunikujeme hlavní myšlenku Tiimiakatemia.'),
  ('A2', 1, 'Udělali jsme návrhy marketingových kampaní pro 5 potenciálních zákazníků.'),
  ('A2', 2, 'Získali jsme 2 zákaznické projekty za tým.'),
  ('A2', 3, 'Máme první marketingové materiály, které prezentují naší týmovou společnost (např. vizitky, webovky, portfolio).'),
  ('A2', 4, 'Na training session tým vedl dialog na základě esejí 4 členů týmu, o knize, kterou schválil kouč (např. Pine & Gilmore: Experience Economy, Godin: Tribes).'),
  ('A1', 0, 'Po ukončení projektu jsme poslali zákazníkovi nabídku, rozvíjíme s ním vztah a plánujeme další spolupráci.'),
  ('A1', 1, 'Spolupracovali jsme se třemi zákazníky. Tito zákazníci navštívili prostředi Tiimiakatemia Prague.'),
  ('A1', 2, 'Začínáme zákaznické vztahy monitorovat v penězích. Finančně oceňujeme budoucí příležitosti a klademe na ně speciální pozornost. Budujeme pipeline svých aktivit.'),
  ('A1', 3, 'Na training session tým vedl dialog na základě esejí 4 členů týmu o knize, kterou schválil kouč (např. Gummeson: Many-to-many Marketing, Prince: Get Rich with Twitter).'),
  ('FIN', 0, 'Každý člen týmové společnosti rozumí základům finančního řízení, tvorbě rozpočtu pro týmovou společnost i pro projekty a základům účetnictví.'),
  ('FIN', 1, 'Sledujeme finanční výsledky. Naše motto je: "Nedává to peníze, nedává to smysl."'),
  ('FIN', 2, 'Na training session vedl tým dialog na základě esejí 4 členů týmu o knize o finančním řízení, kterou schválil kouč.'),
  ('FIN', 3, 'Každý projekt v týmové společnosti vytvořil finanční plán.'),
  ('FIN', 4, 'Na konci prvního účetního období má týmová společnost hotovou účetní uzávěrku a vyhodnocení svého hopodaření.'),
  ('COACH', 0, 'Náš týmový kouč ví jak naslouchat a povzbuzovat. Inspiruje nás a je upřímný a férový.'),
  ('COACH', 1, 'Náš týmový kouč s námi prošel fází pseudotýmu.'),
  ('COACH', 2, 'Náš týmový kouč zná silné a slabé stránky týmové společnosti, týmu a jednotlivých členů a pomohl nám pochopit sílu diverzity.'),
  ('COACH', 3, 'Náš týmový kouč zná své mantinely a nesnaží se vést tým. Neslouží jako terapeut.'),
  ('COACH', 4, 'Náš týmový kouč je vždy přítomný na training session, mentálně i fyzicky. Na TS je připraven a chodí včas.'),
  ('COACH', 5, 'Náš týmový kouč podporuje profesionální rozvoj teamprenérů.'),
  ('COACH', 6, 'Náš týmový kouč se posunul na vnějšího konzultanta, který pomáhá rozvynout náš byznys.'),
  ('COACH', 7, 'Náš týmový kouč je Wonder-koučem komunity.')
) AS v(code, ord, text_cs)
JOIN public.rocket_categories c ON c.code = v.code
WHERE NOT EXISTS (
  SELECT 1 FROM public.rocket_items i
  WHERE i.category_id = c.id AND i.order_index = v.ord
);
