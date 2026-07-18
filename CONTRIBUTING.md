# Contributing to Tappka

# Environment Variables

For local development, you will need to get google client secret. You can either ask Tom for the `GOOGLE_CLIENT_SECRET` or create your own oauth app and set your own `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on new google cloud console project here: https://console.cloud.google.com/auth/clients/create

1. You will create a new google cloud console project
2. You will create a new web oauth app

### Authorized Javascript Origins
```
http://localhost:3000
```

### Authorized Redirect URIs
```
http://127.0.0.1:54321/auth/v1/callback
```

# Database migrations

Here's how to proceed if you want to change anything about the database. I recommend reading [docs/data-layer.md](docs/data-layer.md) to understand how the data layer works before you start.

## Database schema or RLS policies
1. Edit the schema in `db/schema/`
2. Run `pnpm db:migrate` to generate a new migration. IF it asks you whether something is a rename but if you changed the type you need to say no. Otherwise answer how it is.
```bash
pnpm db:migrate
```
```bash
pnpm db:force-migrate # If you don't care about the contents of your local database.
```
## Functions & triggers
To change the functions or triggers, you need to:

1. Generate a new custom migration
```bash
pnpm db:generate:custom
```
2. Edit this new migration to add the function or trigger.
3. Apply the migration
```bash
pnpm db:up # Apply the migration
```
```bash
pnpm db:reset # Wipe your local database and run all migrations from the start
```

# Tests
