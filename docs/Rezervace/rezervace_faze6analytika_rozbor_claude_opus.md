# Fáze 6: Analytika rezervačního systému - Komplexní rozbor

## 1. Přehled problému

Analytika rezervačního systému musí balancovat mezi:
- **Bohatostí dat** - co nejvíce užitečných metrik
- **Výkonem** - minimální zátěž na databázi a aplikaci
- **Spolehlivostí** - konzistentní a přesná data
- **Škálovatelností** - systém musí fungovat i při růstu

---

## 2. Co měřit - Kategorie metrik

### 2.1 Metriky místností

| Metrika | Popis | Využití |
|---------|-------|---------|
| **Využití (%)** | Poměr zarezervovaného času k dostupnému času | Identifikace přetížených/nevyužitých místností |
| **Průměrná délka rezervace** | Jak dlouho trvají typické rezervace | Optimalizace time slotů |
| **Peak hours** | Nejvytíženější hodiny dne | Plánování údržby, úprava pravidel |
| **Počet rezervací/den** | Absolutní čísla | Trend využívání |
| **Cancel rate** | Podíl zrušených rezervací | Identifikace problémových vzorců |
| **No-show rate** | Rezervace bez skutečného využití | Potenciál pro overbooking pravidla |
| **Počet nahlášených problémů** | Issues per room | Identifikace problémových místností |
| **Průměrný počet osob** | Kolik lidí místnost typicky využívá | Kapacitní plánování |

### 2.2 Metriky uživatelů

| Metrika | Popis | Využití |
|---------|-------|---------|
| **Počet rezervací** | Celkový počet za období | Aktivita uživatele |
| **Celkový čas** | Suma hodin rezervací | Využití systému |
| **Oblíbené místnosti** | Nejčastěji rezervované | Personalizace, návrhy |
| **Oblíbené časy** | Preferované hodiny/dny | Personalizace |
| **Reliability score** | Poměr dodržených rezervací | Gamifikace, prioritizace |
| **Cowork účast** | Kolikrát se připojil k cizím rezervacím | Komunitní zapojení |
| **Cancel rate** | Jak často ruší | Identifikace problémových uživatelů |

### 2.3 Metriky časové

| Metrika | Popis | Využití |
|---------|-------|---------|
| **Denní vytížení** | Agregace po dnech v týdnu | Identifikace vzorců |
| **Hodinové vytížení** | Heatmapa hodin | Optimalizace provozní doby |
| **Sezónní trendy** | Měsíční/semestrální porovnání | Dlouhodobé plánování |
| **Lead time** | Jak dopředu lidé rezervují | Nastavení max advance booking |

### 2.4 Metriky systémové

| Metrika | Popis | Využití |
|---------|-------|---------|
| **Konflikty** | Počet odmítnutých rezervací kvůli kolizi | Kapacitní nedostatek |
| **Alternativní návrhy** | Jak často jsou využity | Efektivita algoritmu |
| **TS vs. běžné rezervace** | Poměr typů rezervací | Vliv TS na dostupnost |
| **Houston Calling využití** | Účast na HC | Hodnota automatických rezervací |

---

## 3. Architektonické přístupy

### 3.1 Přístup A: Real-time dotazy (View-based)

```
┌─────────────────────────────────────────┐
│           reservations table            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│    PostgreSQL Views + Materialized      │
│    - room_stats_daily                   │
│    - user_stats_monthly                 │
│    - hourly_heatmap                     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│           API / Dashboard               │
└─────────────────────────────────────────┘
```

**Výhody:**
- Vždy aktuální data
- Žádná duplicita dat
- Jednoduchá údržba

**Nevýhody:**
- Pomalé pro velké datasety
- Zatěžuje DB při každém dotazu
- Náročné komplexní agregace

**Vhodné pro:** Malý až střední objem dat (< 10k rezervací)

---

### 3.2 Přístup B: Inkrementální agregace (Trigger-based)

```
┌─────────────────────────────────────────┐
│           reservations table            │
└─────────────────┬───────────────────────┘
                  │ INSERT/UPDATE/DELETE triggers
                  ▼
┌─────────────────────────────────────────┐
│         analytics_* tables              │
│    - analytics_room_daily               │
│    - analytics_user_monthly             │
│    - analytics_hourly_slots             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Fast reads from pre-computed      │
└─────────────────────────────────────────┘
```

**Výhody:**
- Velmi rychlé čtení
- Data se počítají postupně
- Minimální zátěž při dotazech

**Nevýhody:**
- Komplexnější triggery
- Potenciální nekonzistence při chybách
- Složitější opravy historických dat

**Vhodné pro:** Střední až velký objem dat

---

### 3.3 Přístup C: Batch processing (Cron-based)

```
┌─────────────────────────────────────────┐
│           reservations table            │
└─────────────────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │  Cron job (hourly/daily)         │
      │  - Edge function                  │
      │  - Supabase scheduled function    │
      └───────────┬───────────┘
                  ▼
┌─────────────────────────────────────────┐
│         analytics_snapshots             │
│    - computed periodically              │
│    - historical comparison              │
└─────────────────────────────────────────┘
```

**Výhody:**
- Izolovaná zátěž (off-peak hours)
- Jednoduchá logika
- Snadné znovuvypočítání

**Nevýhody:**
- Data nejsou real-time
- Latence až hodiny/den
- Vyžaduje scheduling infrastrukturu

**Vhodné pro:** Historické reporty, trendy

---

### 3.4 Přístup D: Hybridní (Doporučený)

```
┌─────────────────────────────────────────────────────────────┐
│                     reservations table                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Triggers    │   │  Materialized   │   │   Cron jobs     │
│ (counters)    │   │    Views        │   │  (snapshots)    │
│               │   │  (refresh 1h)   │   │  (daily)        │
└───────┬───────┘   └────────┬────────┘   └────────┬────────┘
        │                    │                     │
        ▼                    ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ room_counters │   │ current_stats   │   │ historical_     │
│ user_counters │   │ (today/week)    │   │ analytics       │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │   Analytics API     │
                  │   Dashboard UI      │
                  └─────────────────────┘
```

**Kombinuje:**
1. **Triggery** pro jednoduché čítače (počet rezervací, celkový čas)
2. **Materialized views** pro aktuální statistiky (refresh každou hodinu)
3. **Cron joby** pro historické snapshoty a trendy

---

## 4. Návrh databázového schématu

### 4.1 Tabulky pro čítače (trigger-updated)

```sql
-- Denní statistiky místností
CREATE TABLE analytics_room_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Čítače
  reservation_count INT DEFAULT 0,
  total_minutes INT DEFAULT 0,
  cancelled_count INT DEFAULT 0,
  total_persons INT DEFAULT 0,
  
  -- Odvozené při zápisu
  avg_duration_minutes NUMERIC(6,2),
  avg_persons NUMERIC(4,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(room_id, date)
);

-- Měsíční statistiky uživatelů
CREATE TABLE analytics_user_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year_month CHAR(7) NOT NULL, -- '2026-01'
  
  reservation_count INT DEFAULT 0,
  total_minutes INT DEFAULT 0,
  cancelled_count INT DEFAULT 0,
  cowork_joins INT DEFAULT 0,
  
  -- Odvozené
  reliability_score NUMERIC(5,4), -- 0.0000 - 1.0000
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, year_month)
);

-- Hodinová heatmapa (agregovaná)
CREATE TABLE analytics_hourly_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0-6
  hour INT NOT NULL, -- 0-23
  
  reservation_count INT DEFAULT 0,
  total_minutes INT DEFAULT 0,
  
  UNIQUE(room_id, day_of_week, hour)
);
```

### 4.2 Tabulka pro snapshoty (cron-updated)

```sql
-- Historické snapshoty pro trend analýzu
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  snapshot_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  
  -- JSON blob pro flexibilitu
  room_stats JSONB,
  user_stats JSONB,
  system_stats JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Příklad room_stats:
-- {
--   "d126": {"utilization": 0.75, "avg_duration": 120, "reservations": 15},
--   "d132": {"utilization": 0.60, "avg_duration": 90, "reservations": 12}
-- }
```

### 4.3 Materialized views pro rychlé dotazy

```sql
-- Aktuální týdenní přehled
CREATE MATERIALIZED VIEW mv_current_week_stats AS
SELECT 
  r.room_id,
  rm.code as room_code,
  rm.name as room_name,
  COUNT(*) as reservation_count,
  SUM(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 60) as total_minutes,
  AVG(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 60) as avg_duration,
  COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled_count
FROM reservations r
JOIN rooms rm ON r.room_id = rm.id
WHERE r.start_time >= date_trunc('week', CURRENT_DATE)
  AND r.start_time < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
GROUP BY r.room_id, rm.code, rm.name;

-- Refresh pomocí cron nebo při dashboard loadu
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_week_stats;
```

---

## 5. Trigger implementace

```sql
-- Trigger pro aktualizaci room_daily při INSERT
CREATE OR REPLACE FUNCTION update_room_daily_stats()
RETURNS TRIGGER AS $$
DECLARE
  res_date DATE;
  duration_mins INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    res_date := DATE(NEW.start_time);
    duration_mins := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    
    INSERT INTO analytics_room_daily (room_id, date, reservation_count, total_minutes, total_persons)
    VALUES (NEW.room_id, res_date, 1, duration_mins, COALESCE(NEW.person_count, 0))
    ON CONFLICT (room_id, date) DO UPDATE SET
      reservation_count = analytics_room_daily.reservation_count + 1,
      total_minutes = analytics_room_daily.total_minutes + duration_mins,
      total_persons = analytics_room_daily.total_persons + COALESCE(NEW.person_count, 0),
      avg_duration_minutes = (analytics_room_daily.total_minutes + duration_mins)::NUMERIC 
                            / (analytics_room_daily.reservation_count + 1),
      updated_at = NOW();
      
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'cancelled' THEN
    res_date := DATE(NEW.start_time);
    
    UPDATE analytics_room_daily SET
      cancelled_count = cancelled_count + 1,
      updated_at = NOW()
    WHERE room_id = NEW.room_id AND date = res_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_analytics
AFTER INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_room_daily_stats();
```

---

## 6. API návrh

### 6.1 Endpoints

```
GET /api/analytics/rooms
  ?period=week|month|quarter|year
  ?room_id=optional

GET /api/analytics/rooms/:id/heatmap

GET /api/analytics/users
  ?period=month|quarter|year
  ?user_id=optional

GET /api/analytics/trends
  ?metric=utilization|reservations|duration
  ?granularity=day|week|month

GET /api/analytics/dashboard
  (agregovaný endpoint pro admin dashboard)
```

### 6.2 Response příklady

```json
// GET /api/analytics/rooms?period=week
{
  "period": { "start": "2026-01-27", "end": "2026-02-02" },
  "rooms": [
    {
      "id": "...",
      "code": "d126",
      "name": "Místnost D126",
      "stats": {
        "utilization": 0.72,
        "reservation_count": 18,
        "total_hours": 54,
        "avg_duration_minutes": 180,
        "cancelled_count": 2,
        "cancel_rate": 0.10,
        "peak_hour": 14,
        "avg_persons": 4.2
      }
    }
  ]
}
```

---

## 7. Dashboard UI návrh

### 7.1 Admin dashboard sekce

1. **Overview karty**
   - Celkové využití tento týden (%)
   - Počet rezervací dnes/tento týden
   - Nejaktivnější místnost
   - Nejaktivnější uživatel

2. **Heatmapa**
   - Řádky = místnosti
   - Sloupce = hodiny (7-22)
   - Barva = intenzita využití
   - Filtr: den v týdnu

3. **Trend graf**
   - Čárový graf využití v čase
   - Porovnání místností
   - Období: 4 týdny / 3 měsíce / rok

4. **Top seznamy**
   - Top 10 uživatelů (počet rezervací)
   - Top 10 uživatelů (celkový čas)
   - Místnosti s nejvyšším cancel rate

5. **Problémy**
   - Místnosti s častými issues
   - Nejčastější typy problémů

---

## 8. Výkonnostní úvahy

### 8.1 Indexy

```sql
-- Pro rychlé dotazy na analytics tabulky
CREATE INDEX idx_room_daily_date ON analytics_room_daily(date DESC);
CREATE INDEX idx_room_daily_room ON analytics_room_daily(room_id, date DESC);
CREATE INDEX idx_user_monthly_user ON analytics_user_monthly(user_id, year_month DESC);
CREATE INDEX idx_heatmap_room ON analytics_hourly_heatmap(room_id);
```

### 8.2 Materialized view refresh strategie

| View | Refresh interval | Metoda |
|------|------------------|--------|
| `mv_current_week_stats` | 1 hodina | Cron |
| `mv_current_month_stats` | 6 hodin | Cron |
| `mv_room_heatmap` | 1x denně | Cron (noční) |

### 8.3 Doporučené limity

- Denní statistiky: uchovávat 2 roky, poté agregovat do měsíčních
- Snapshoty: denní uchovávat 90 dní, týdenní 1 rok, měsíční navždy
- Heatmapa: rolling window posledních 90 dní

---

## 9. Implementační fáze

### Fáze 6a: Základní infrastruktura
1. Vytvořit analytics tabulky
2. Implementovat triggery pro čítače
3. Seed historických dat (pokud existují)

### Fáze 6b: API vrstva
1. Analytics API routes
2. Caching strategie (Redis nebo in-memory)
3. Rate limiting pro náročné dotazy

### Fáze 6c: Dashboard UI
1. Admin analytics stránka
2. Karty s klíčovými metrikami
3. Interaktivní grafy (Recharts / Chart.js)
4. Heatmapa komponenta

### Fáze 6d: Automatizace
1. Supabase Edge Function pro daily snapshots
2. Materialized view refresh scheduling
3. Alerting při anomáliích

---

## 10. Bezpečnostní aspekty

- Analytics data jsou citlivá (kdo, kdy, kde)
- RLS politiky: pouze admin/coach vidí agregovaná data
- Uživatel vidí pouze své vlastní statistiky
- Anonymizace při exportu

---

## 11. Alternativní technologie

| Technologie | Pro | Proti |
|-------------|-----|-------|
| **PostHog** | Event tracking, funnels, dashboards | Další závislost, cena |
| **Plausible/Umami** | Privacy-focused, jednoduchý setup | Omezené custom metriky |
| **ClickHouse** | Extrémně rychlé agregace | Složitý setup, overkill |
| **Supabase native** | Žádná další závislost | Manuální implementace |

**Doporučení:** Pro Tappku stačí Supabase native s hybridním přístupem (triggery + cron + views).

---

## 12. Shrnutí doporučení

1. **Architektura:** Hybridní přístup (triggery + materialized views + cron snapshots)
2. **Prioritní metriky:** Využití místností, peak hours, user reliability
3. **Storage:** Dedikované analytics tabulky, ne real-time dotazy
4. **Refresh:** Triggery pro čítače, hourly refresh views, daily snapshots
5. **UI:** Jednoduchý dashboard s kartami, heatmapou a trend grafem
6. **Bezpečnost:** Striktní RLS, admin-only přístup k agregovaným datům

---

## 13. Otevřené otázky k diskuzi

1. Jak definovat "no-show"? (Potřeba check-in systém?)
2. Chceme gamifikaci? (Leaderboardy, badges za reliability)
3. Export dat? (CSV/Excel pro management)
4. Real-time dashboard nebo stačí refresh při loadu?
5. Notifikace při anomáliích? (Neobvykle vysoký cancel rate)

---

*Vytvořeno modelem: **Claude Opus 4.5** (Anthropic)*
