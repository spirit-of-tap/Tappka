import { expect, test, type Page } from '@playwright/test';
import {
  cleanupTestData,
  getSetupSessionCookie,
  setAuthCookie,
} from './fixtures/auth';

/**
 * A unique ISBN + unique title per test. findDuplicate returns a match when
 * ISBN-13 collides, but ALSO when (normalized author, normalized title) match —
 * so the submit path is only collision-free when every test submits a book
 * combination no other test (or a leftover from a crashed run) could produce.
 */
function uniqueIsbn(): string {
  return `978${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`;
}

function uniqueTitle(prefix: string, isbn: string): string {
  return `${prefix} ${isbn}`;
}

interface BookCandidate {
  title: string;
  author: string;
  isbn_13: string;
  description: string | null;
  cover_url: string | null;
  page_count: number;
  publisher: string;
  published_year: number;
  preview_link: string | null;
  source: string;
  external_id: string;
}

interface EnrichedBook {
  data: {
    title_cs: string;
    title_en: string;
    author: string;
    isbn_13: string;
    page_count: number;
    description: string;
    tag: string;
    suggested_points: number;
    points_reason: string;
    confidence: string;
    low_confidence_fields: string[];
  };
  citations: string[];
}

const ENRICHED = (isbn: string): EnrichedBook => ({
  data: {
    title_cs: 'Sprint',
    title_en: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: isbn,
    page_count: 288,
    description: 'Naučíš se otestovat nápad za pět dní. Je to hutné a procesní.',
    tag: 'Inovace & kreativita',
    suggested_points: 2,
    points_reason: 'Kategorie 2 — procesní manuál s frameworky, 288 stran.',
    confidence: 'high',
    low_confidence_fields: [],
  },
  citations: ['https://www.goodreads.com/book/show/35019409-sprint'],
});

function sprintCandidate(isbn: string): BookCandidate {
  return {
    title: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: isbn,
    description: null,
    cover_url: null,
    page_count: 288,
    publisher: 'Simon & Schuster',
    published_year: 2016,
    preview_link: null,
    source: 'google_books',
    external_id: 'vol-1',
  };
}

async function stubFlow(page: Page, candidate: BookCandidate, enriched: EnrichedBook) {
  await page.route('**/api/books/external-search**', (route) =>
    route.fulfill({ json: { data: [candidate] } }),
  );
  // The catalogue search runs against the real DB, and `q=sprint` matches the
  // Sprint already in it. A hit now collapses the external results behind a
  // confirmation, so stub it empty and let one dedicated test cover that guard.
  await page.route('**/api/books/search**', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/books/enrich', (route) => route.fulfill({ json: enriched }));
}

/** Krok 1 → Krok 2: affirm the gate, then pick the only external candidate. */
async function passGateAndPick(page: Page) {
  await page.getByRole('button', { name: /pojďme na to/i }).click();
  await page.getByRole('button', { name: /Jake Knapp/ }).click();
}

test.describe('adding a book', () => {
  test('gate → search → enrichment → checkout → submitted', async ({ page }) => {
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    const isbn = uniqueIsbn();
    // A unique title matters as much as the ISBN: dedupe matches on title for a
    // given author, so two parallel tests must never share (author, title).
    const title = uniqueTitle('E2E Sprint Manual', isbn);
    await stubFlow(page, { ...sprintCandidate(isbn), title }, {
      ...ENRICHED(isbn),
      data: { ...ENRICHED(isbn).data, title_cs: title, title_en: title },
    });

    const createResponses: number[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/api/books') && response.request().method() === 'POST') {
        createResponses.push(response.status());
      }
    });

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');

    // Krok 1 — the gate shows what does not belong, and must be affirmed.
    await expect(page.getByText('Tyhle ne')).toBeVisible();
    // The rubric is for the model; it must never be on this screen.
    await expect(page.getByText(/Inspirace/)).toHaveCount(0);
    await page.getByRole('button', { name: /pojďme na to/i }).click();

    // Krok 2 — the candidate card carries the metadata the rubric needs.
    await expect(page.getByText(/288/)).toBeVisible();
    await page.getByRole('button', { name: /Jake Knapp/ }).click();

    // Krok 4 — the score is the model's verdict, with no control to change it.
    await expect(page.getByLabel(/český název/i)).toHaveValue(title);
    await expect(page.getByText(/procesní manuál/i)).toBeVisible();
    await expect(page.getByLabel('Knižní body: 2')).toBeVisible();
    await expect(page.getByRole('button', { name: /\d\s*b\./i })).toHaveCount(0);

    await page.getByRole('button', { name: /odeslat ke schválení/i }).click();

    // The POST can be slow (notification emails run inside the route), so wait
    // for the redirect rather than racing a toast against a 5s default. The
    // book must be created — a 201 means it isn't a dedupe 409.
    await page.waitForURL(/\/cteni\/knihy\/[0-9a-f-]{36}$/);
    expect(createResponses[0]).toBe(201);
  });

  test("the coach's points replace the suggestion, and only then count", async ({ page, browser }) => {
    // The property Task 3's integration layer cannot prove: a student writes
    // book_points on insert, and it must not become the awarded score. Only a
    // coach's classify decision does. This needs the real query path, so it
    // lives at the E2E layer per docs/runbooks/testing.md.
    const isbn = uniqueIsbn();

    // Student submits the book with a suggested 2 points.
    const student = await getSetupSessionCookie();
    await setAuthCookie(page.context(), student.cookie);
    // Unique title: dedupe matches on (author, title), so this must not share
    // the combo used by the other parallel tests.
    const title = uniqueTitle('E2E Coach Points Manual', isbn);
    await stubFlow(page, { ...sprintCandidate(isbn), title }, {
      ...ENRICHED(isbn),
      data: { ...ENRICHED(isbn).data, title_cs: title, title_en: title },
    });

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');
    await passGateAndPick(page);
    await page.getByRole('button', { name: /odeslat ke schválení/i }).click();
    await page.waitForURL(/\/cteni\/knihy\/[0-9a-f-]{36}$/);
    const bookId = new URL(page.url()).pathname.split('/').pop()!;

    // The suggestion is stored, but not yet awarded.
    const stored = await (await page.request.get(`/api/books/${bookId}`)).json();
    expect(Number(stored.data.book_points)).toBe(2);
    expect(stored.data.list_status).toBe('processing');
    await expect(page.getByText('Zpracovává se')).toBeVisible();

    // Coach re-scores it to 1.
    const coach = await getSetupSessionCookie(undefined, 'coach');
    const coachContext = await browser.newContext();
    await setAuthCookie(coachContext, coach.cookie);
    const coachPage = await coachContext.newPage();

    await coachPage.goto('/cteni/sprava');
    // Pick this book out of the queue rail — parallel specs leave their own
    // books pending, so the workbench's default selection is not ours.
    await coachPage.getByRole('navigation', { name: /fronta/i }).getByText(title).click();
    const reason = coachPage.locator(`#reason-${bookId}`);
    await expect(reason).toBeVisible();

    // The picker opens on the AI's suggestion; overriding it is the point of the test.
    await expect(coachPage.getByRole('radio', { name: '2 body' })).toHaveAttribute('data-state', 'on');
    await reason.fill('Procesní manuál, ale krátký — 1 bod.');
    await coachPage.getByRole('radio', { name: '1 bod' }).click();
    await coachPage.getByRole('button', { name: /schválit do longlistu/i }).click();

    // Wait for the classify PATCH to finish before reading the book back —
    // the toast only fires after the response, so it also proves the commit.
    await expect(coachPage.getByText(/schválena do longlistu/i)).toBeVisible();

    // The stored score is now the coach's, not the student's suggestion.
    const decided = await (await coachPage.request.get(`/api/books/${bookId}`)).json();
    expect(Number(decided.data.book_points)).toBe(1);
    expect(decided.data.list_status).toBe('longlist');

    await coachPage.goto(`/cteni/knihy/${bookId}`);
    await expect(coachPage.getByText('1 bod')).toBeVisible();

    await coachContext.close();
  });

  test('submits a co-authored book without a server error', async ({ page }) => {
    // Regression guard for the duplicate-check query. `ExternalBookCandidate.author`
    // is built as `authors.join(', ')`, and a comma is the clause separator inside a
    // PostgREST `or` filter — an interpolated `or` string 500s on every co-authored
    // book. Task 2's unit tests cover findDuplicate's matching but cannot see the
    // route's query, so the guard has to live here.
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    const isbn = uniqueIsbn();
    // A unique title is essential: the real "Sprint" book in the dev DB is
    // itself co-authored, so reusing it would dedupe (409) instead of creating.
    const title = uniqueTitle('E2E Co-authored Manual', isbn);
    await stubFlow(page, { ...sprintCandidate(isbn), title }, {
      ...ENRICHED(isbn),
      data: {
        ...ENRICHED(isbn).data,
        title_cs: title,
        title_en: title,
        author: 'Jake Knapp, John Zeratsky, Braden Kowitz',
      },
    });

    const createResponses: number[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/api/books') && response.request().method() === 'POST') {
        createResponses.push(response.status());
      }
    });

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');
    await passGateAndPick(page);
    await expect(page.getByLabel(/autor/i)).toHaveValue(/Zeratsky/);
    await page.getByRole('button', { name: /odeslat ke schválení/i }).click();

    await page.waitForURL(/\/cteni\/knihy\/[0-9a-f-]{36}$/);
    // 201 created — never 500 (the comma-separated author kept the route from
    // building a broken PostgREST `or` filter).
    expect(createResponses.every((status) => status !== 500)).toBe(true);
    expect(createResponses[0]).toBe(201);
  });

  test('falls back to manual entry when enrichment is unavailable', async ({ page }) => {
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route('**/api/books/enrich', (route) =>
      route.fulfill({ status: 503, json: { error: 'Perplexity teď neodpovídá.' } }),
    );

    await page.goto('/cteni/knihy/nova?from=hledat');
    await page.getByRole('button', { name: /pojďme na to/i }).click();

    await page.getByRole('button', { name: /zadat ručně/i }).click();
    await page.getByLabel(/^název$/i).fill('Tiimiakatemia');
    await page.getByLabel(/^autor$/i).fill('Johannes Partanen');
    await page.getByRole('button', { name: /pokračovat/i }).click();

    await expect(page.getByText(/neodpovídá/i)).toBeVisible();
    await page.getByRole('button', { name: /vyplnit ručně/i }).click();

    // The record is still completable by hand, and still gated. Without an
    // enrichment there is no score to show, so the coach assigns one.
    const submit = page.getByRole('button', { name: /odeslat ke schválení/i });
    await expect(submit).toBeDisabled();
    await expect(page.getByText('Body přidělí kouč.')).toBeVisible();

    await page.getByLabel(/popis/i).fill('Naučíš se, jak funguje týmové podnikání na Tiimi.');
    await page.getByLabel(/oblast/i).selectOption('Leadership');

    await expect(submit).toBeEnabled();
  });

  test('a book the model refuses dead-ends, and the appeal still reaches the coach', async ({
    page,
  }) => {
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    const isbn = uniqueIsbn();
    const title = uniqueTitle('E2E Refused Manual', isbn);

    await stubFlow(page, { ...sprintCandidate(isbn), title }, {
      data: {
        ...ENRICHED(isbn).data,
        title_cs: title,
        title_en: title,
        description: 'ZAMÍTNUTO: Kniha nesouvisí se zaměřením programu TAP.',
        suggested_points: 0,
        points_reason: 'Beletrie — rozhoduje žánr, ne téma.',
      },
      citations: [],
    });

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');
    await passGateAndPick(page);

    // The refusal holds: no form, no submit button.
    await expect(page.getByRole('heading', { name: /nemyslí, že tahle kniha/i })).toBeVisible();
    await expect(page.getByText('Beletrie — rozhoduje žánr, ne téma.')).toBeVisible();
    await expect(page.getByLabel(/český název/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /odeslat/i })).toHaveCount(0);

    // Appealing asks for an argument, and will not submit without one.
    await page.getByRole('button', { name: /pokračovat přesto/i }).click();
    const submit = page.getByRole('button', { name: /odeslat ke schválení/i });
    await expect(submit).toBeDisabled();
    await expect(page.getByLabel('Knižní body: 0')).toBeVisible();

    await page
      .getByLabel(/proč kniha do boba patří/i)
      .fill('Je to případová studie o týmovém podnikání, ne beletrie.');
    await expect(submit).toBeEnabled();
  });

  test('warns instead of quietly offering a duplicate', async ({ page }) => {
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    const isbn = uniqueIsbn();

    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({ json: { data: [sprintCandidate(isbn)] } }),
    );
    await page.route('**/api/books/search**', (route) =>
      route.fulfill({
        json: { data: [{ id: 'existing-1', title_cs: 'Sprint', author: 'Jake Knapp' }] },
      }),
    );

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');
    await page.getByRole('button', { name: /pojďme na to/i }).click();

    await expect(page.getByText(/už v BOBovi máme/i)).toBeVisible();
    await expect(page.getByText(/mimo katalog/i)).toHaveCount(0);

    await page.getByRole('button', { name: /přesto přidat jinou verzi/i }).click();
    await expect(page.getByText(/mimo katalog/i)).toBeVisible();
  });

  test('warns about a duplicate found through an ISBN query', async ({ page }) => {
    const { cookie } = await getSetupSessionCookie();
    await setAuthCookie(page.context(), cookie);
    const isbn = uniqueIsbn();

    // The ISBN resolves externally to "Sprint"; the catalogue has the same
    // work under a different ISBN — the record must still surface as a
    // duplicate via its title.
    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({ json: { data: [sprintCandidate(isbn)] } }),
    );
    await page.route('**/api/books/search**', (route) =>
      route.fulfill({
        json: { data: [{ id: 'existing-1', title_cs: 'Sprint', author: 'Jake Knapp' }] },
      }),
    );

    await page.goto(`/cteni/knihy/nova?q=${isbn}&from=hledat`);
    await page.getByRole('button', { name: /pojďme na to/i }).click();

    await expect(page.getByText(/už v BOBovi máme/i)).toBeVisible();
    await expect(page.getByText(/mimo katalog/i)).toHaveCount(0);
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});
