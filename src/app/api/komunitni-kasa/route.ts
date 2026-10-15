import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { serverLogger } from "@/lib/server-logger";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";
import {
  KASA_BANK_ACCOUNT_ID,
  KASA_MAX_PAGES,
  KASA_PAGE_SIZE,
} from "@/lib/komunitni-kasa/stats";
import type {
  KasaResponse,
  RbTransaction,
  RbTransactionListResponse,
} from "@/lib/komunitni-kasa/types";

export const revalidate = 300;

const RB_BASE = "https://www.rb.cz/frontend-controller/backend-data/transparent-account";

interface RbAccountListItem {
  firstName: string;
  numberPart2: string | null;
  currencyItems: { idBankAccount: number; currencyCode: string; buBalance: number }[];
}

async function fetchRbTransactions(): Promise<RbTransaction[]> {
  const all: RbTransaction[] = [];
  let fromIndex = 0;

  for (let page = 0; page < KASA_MAX_PAGES; page += 1) {
    const url =
      `${RB_BASE}/transactionList?idBankAccount=${KASA_BANK_ACCOUNT_ID}` +
      `&language=cs&fromIndex=${fromIndex}&maxResults=${KASA_PAGE_SIZE}&dateFrom=&dateTo=&q=`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Tappka Komunitni kasa)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`RB transactionList: ${res.status}`);
    const data = (await res.json()) as RbTransactionListResponse;
    all.push(...data.transactions);
    if (data.endOfRecords) break;
    if (data.nextStartIndex < 0) break;
    fromIndex = data.nextStartIndex;
  }

  return all.sort((a, b) => {
    const da = new Date(a.realizationDate ?? a.datum ?? "").getTime();
    const db = new Date(b.realizationDate ?? b.datum ?? "").getTime();
    return db - da;
  });
}

async function fetchRbAccount(): Promise<KasaResponse["account"]> {
  const fallback = {
    name: "Spirit of TAP, z.s.",
    number: "223152036/5500",
    balance: null as number | null,
    currency: "CZK",
  };
  try {
    const res = await fetch(`${RB_BASE}/list?language=cs`, {
      headers: { "User-Agent": "Mozilla/5.0 (Tappka Komunitni kasa)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const list = (await res.json()) as RbAccountListItem[];
    for (const item of list) {
      const currency = item.currencyItems.find((c) => c.idBankAccount === KASA_BANK_ACCOUNT_ID);
      if (currency) {
        return {
          name: item.firstName.replace(/\s+,/g, ",").trim(),
          number: `${item.numberPart2 ?? "223152036"}/5500`,
          balance: currency.buBalance,
          currency: currency.currencyCode,
        };
      }
    }
  } catch (error) {
    serverLogger.console.error("GET /api/komunitni-kasa account error:", error);
  }
  return fallback;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user: { id: claimsData.claims.sub } });
    const allowed = profile
      ? canAccessFeature(
          {
            role: profile.role,
            beta_access_granted_at: profile.beta_access_granted_at,
            beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
          },
          "komunitniKasa",
        )
      : false;
    if (!allowed) {
      return NextResponse.json({ error: "K této funkci nemáš přístup" }, { status: 403 });
    }

    const [account, transactions] = await Promise.all([
      fetchRbAccount(),
      fetchRbTransactions(),
    ]);

    // Zůstatek z detailu účtu chybí → odvoď ze součtu transakcí.
    if (account.balance == null) {
      account.balance = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    return NextResponse.json({
      account,
      transactions,
      fetchedAt: new Date().toISOString(),
    } satisfies KasaResponse);
  } catch (error) {
    serverLogger.console.error("GET /api/komunitni-kasa error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se načíst data transparentního účtu" },
      { status: 502 },
    );
  }
}
