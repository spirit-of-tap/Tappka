# Realtime architektura

Tappka využívá reálný přenos dat v reálném čase k tomu, aby uživatelé kampusu okamžitě viděli změny v obsazenosti místností, nově schválené eseje nebo týmová oznámení bez nutnosti ručního obnovování stránky.

Tento dokument stanovuje architektonická pravidla a konvence pro práci s reálným časem v Tappce.

---

## 1. Zásadní princip: Broadcast místo Postgres Changes

V souladu s pravidly v [`AGENTS.md`](/runbooks/agents-and-code-style):

> **Používej výhradně `broadcast` — nikdy ne `postgres_changes`.**

### Proč nepoužívat `postgres_changes`?
1. **Škálovatelnost a zátěž databáze:** `postgres_changes` naslouchá na úrovni Write-Ahead Logu (WAL) PostgreSQL. Při vysokém počtu paralelních spojení (např. desítky tabletů na dveřích místností a mobilů studentů) způsobuje výrazné vytížení procesoru databáze.
2. **Bezpečnostní riziko:** Filtrování řádků přímo ve WAL může v určitých kombinacích obcházet komplexní RLS pravidla nebo leakovat nechtěná metadata.
3. **Předvídatelnost:** S technologií `broadcast` odesílá zprávu přímo aplikační vrstva (např. Server Action po úspěšném zápisu rezervace) s přesně definovanou strukturou dat.

---

## 2. Jmenné konvence

### Názvy kanálů (Topics)
Všechny kanály musí dodržovat strukturu třísložkového identifikátoru:
```
scope:entity:id
```

Příklady:
- `reservations:room:d107` — změny stavu a nové rezervace pro místnost D107.
- `team:alpha:reflections` — týmové reflexe pro společnost Alpha.
- `user:uuid-1234:notifications` — osobní notifikace konkrétního uživatele.

### Názvy událostí (Events)
Události se pojmenovávají v formátu `entity_action` v `snake_case`:
- `reservation_created`
- `reservation_cancelled`
- `essay_reviewed`
- `copy_borrowed`

### Vynucení privátních kanálů
Všechny kanály **musí mít nastaveno `private: true`**. Tím Supabase ověřuje JWT token uživatele před připojením k WebSocketu.

---

## 3. Implementační vzor na klientovi

Každý klientský hook nebo komponenta naslouchající na události musí garantovat správný životní cyklus (subscribe a cleanup):

```tsx
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface RoomRealtimeProps {
  roomId: string;
  onRoomUpdated: () => void;
}

export function useRoomRealtime({ roomId, onRoomUpdated }: RoomRealtimeProps) {
  useEffect(() => {
    const supabase = createClient();
    const topic = `reservations:room:${roomId}`;

    const channel = supabase.channel(topic, {
      config: {
        private: true,
      },
    });

    channel
      .on("broadcast", { event: "reservation_created" }, (payload) => {
        console.log("Nová rezervace:", payload);
        onRoomUpdated();
      })
      .on("broadcast", { event: "reservation_cancelled" }, () => {
        onRoomUpdated();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`Připojeno ke kanálu ${topic}`);
        }
      });

    // Zásadní: Vždy provést cleanup při unmountu komponenty
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onRoomUpdated]);
}
```

---

## 4. Odeslání zprávy ze serveru (Server Action / Route Handler)

Při vytvoření nebo zrušení záznamu odešle server po úspěšné databázové transakci broadcast zprávu:

```typescript
import { createClient } from "@/lib/supabase/server";

export async function notifyReservationCreated(roomId: string, reservationId: string) {
  const supabase = await createClient();
  const topic = `reservations:room:${roomId}`;

  await supabase.channel(topic).send({
    type: "broadcast",
    event: "reservation_created",
    payload: {
      reservationId,
      timestamp: new Date().toISOString(),
    },
  });
}
```
Klient, který má otevřenou detailní obrazovku místnosti nebo tablet u dveří, okamžitě překreslí stav na "Obsazeno" bez zpoždění.
