# PostHog Source Maps Setup Report

## Result

PostHog Error Tracking source map upload is wired into the Next.js production build with `@posthog/nextjs-config`. The integration generates source maps, injects chunk IDs, uploads matching maps during the build, and deletes local map files after upload.

## Files changed

- `next.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `src/components/posthog-source-map-test-button.tsx`

The temporary home-page test integration was reverted after testing. The temporary component file has no remaining code, but this environment did not provide a file-deletion operation; delete the empty `src/components/posthog-source-map-test-button.tsx` file from the working tree.

## Environment variables

The following keys were written to the gitignored `.env` file. No values are included here.

- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`

## Build, upload, and run commands

- Production build and automatic source map upload: `pnpm build`
- Run the built application: `pnpm start`
- Separate upload command: none. `withPostHogConfig` performs source map generation, chunk-ID injection, and upload as part of `pnpm build`.

## CI/CD follow-up

Production deployment is Vercel-managed. The repository's GitHub Actions workflow is a test workflow rather than the production deployment path, so no repository CI file was changed.

Before the next Vercel deployment, add these environment variables in the Tappka Vercel project under **Settings → Environment Variables** for every environment that runs source map-uploading builds (at minimum Production; add Preview too if preview builds should upload):

- `POSTHOG_API_KEY` — store as a sensitive value
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`

Do not commit their values or place them in `vercel.json`.

## Verification

1. Run or deploy a production build with `pnpm build` and all three variables available at build time.
2. Open the PostHog Symbol sets page: https://eu.posthog.com/project/124948/error_tracking/configuration
3. Confirm a new JavaScript symbol set appears for the build.
4. Trigger an exception from the deployed build and confirm its stack trace resolves to original source files rather than minified bundle paths.

The configured `pnpm typecheck` command passed after the permanent integration changes. A temporary **Test PostHog Error Tracking** button was used for the guided test and removed from the application afterward.
