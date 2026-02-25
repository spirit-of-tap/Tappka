# AGENTS.md - Tappka

Next.js 16 + React 19 + Supabase + Tailwind CSS v4 + shadcn/ui. Package manager: pnpm.

## Commands

```bash
pnpm dev        # Start dev server + local Supabase
pnpm build      # Production build
pnpm lint       # ESLint
pnpm supabase:start
pnpm supabase:stop
```

## Code Style

- **TypeScript strict mode** - no `any`, use `interface` over `type`, prefer `??` over `||`
- **Naming**: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files
- **Imports**: external → `@/` internal → styles. One blank line between groups.
- **React**: default to Server Components; use `"use client"` only for interactivity, browser APIs, or third-party init
- **Constants**: never hardcode magic values - extract to named constants or `as const` objects

## Database Migrations

**CRITICAL**: Always write migrations as files AND apply them via MCP.

1. Create the file: `supabase/migrations/YYYYMMDDHHmmss_description.sql`
2. Apply via MCP tool (`supabase_apply_migration`)

Never only apply via MCP without saving the file — the local migration history will drift.

### Migration rules
- Always enable RLS on new tables
- Separate policies per operation: one `select`, one `insert`, one `update`, one `delete`
- Use `SECURITY INVOKER` and `set search_path = ''` in all functions
- Use `(select auth.uid())` (not bare `auth.uid()`) in RLS policies for performance
- Lowercase SQL keywords, snake_case identifiers, fully qualified names (`public.table`)

## Realtime

- Use `broadcast` — never `postgres_changes`
- Topic naming: `scope:entity:id` (e.g. `user:123:notifications`)
- Event naming: `entity_action` snake_case (e.g. `message_created`)
- Set `private: true` on all channels; always include cleanup/unsubscribe

## Environment

- Copy `.env.local.example` → `.env.local` for local dev
- Never commit `.env.local` or secrets
