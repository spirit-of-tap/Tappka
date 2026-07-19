# Contributing to Tappka

# Environment Variables

Make sure that the project can run without setting up any environment variables, this is so that we can get new T's to start vibecoding without them giving up. If there are any environment variables that are required, either add them to the `.env.example` file if they are not sensitive or Create a guide here for how to set them up and add it to the script in `scripts/package-json-helpers/required-dev-env.js`. The script will check for the environment variables and if they are not set, it will prompt the user to set them up.

## Google OAuth

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

Here's how to proceed if you want to change anything about the database. I recommend reading [Data layer](/data-layer) to understand how the data layer works before you start.

## Database schema or RLS policies
1. Edit the schema in `db/schema/`
2. Run `pnpm db:migrate` to generate a new migration. IF it asks you whether something is a rename but you changed the type you need to say no. Otherwise answer how it is.
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
To run the tests, you need to:
```bash
pnpm test
```
```bash
pnpm test:watch # Watch for changes and run the tests automatically
```

# Supabase

Supabase database is developed locally and synced automatically whenever pushed to preview or production branch
Supabase Auth needs to be configured both on the project itself and in the local development environment.

In case there is a conflict on the preview branch, somebody will reset the database. Therefore **do not store anything important in the preview database**. For important testing data put them into supabase/seed.sql

## Recreating the Supabase preview branch

If the persistent Supabase `preview` branch is deleted and recreated, it gets a **new project ref**. Update both of the following before auth/SMTP config will work again:

1. **Set `[remotes.preview] project_id` in [`supabase/config.toml`](/supabase/config.toml)** to the new branch project ref.
   - Find the ref in the [Supabase branches dashboard](https://supabase.com/dashboard/project/jmxckxeiletcyhysheib/branches) (parent project), or via:
     ```bash
     pnpm supabase branches list --project-ref jmxckxeiletcyhysheib --output json
     ```
   - Example shape in `config.toml`:
     ```toml
     [remotes.preview]
     project_id = "<new-preview-project-ref>"
     ```
   - Open the new branch project: `https://supabase.com/dashboard/project/<new-preview-project-ref>`

2. **Set the Google OAuth authorized redirect URI** to the new Supabase Auth callback:
   - Callback URL format: `https://<new-preview-project-ref>.supabase.co/auth/v1/callback`
   - Edit the shared client in [Google Auth clients](https://console.cloud.google.com/auth/clients) 
   - Replace the old preview callback entry under **Authorized redirect URIs** with the new one.


# Recommended Tools

It is very nice to setup mcp with cursor for supabase. Look at [Supabase locally](http://localhost:54323) and go to the top for connection button. It will give you the option.
There are cursor rules made for this nextjs project.

# Publishing the project to the public

You can simply **push to the preview branch** and it will be deployed to the preview environment. - [preview.tiimi.cz](https://preview.tiimi.cz)
For production you will need to make a **pull request to the production branch** and it will be deployed to the production environment. You can approve it yourself, it's just for protection so that you don't accidentally deploy something to production.
