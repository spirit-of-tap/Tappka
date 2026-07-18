<div align="center" style="background: #fcfff7; padding: 2rem 1rem; border-radius: 16px;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; margin-bottom: 1rem;">
    <img src="public/tap_logo.png" alt="Tiimiakatemia Prague" width="100" height="100" style="border-radius: 12px;" />
    <img src="public/pef_logo/CZU_PEF_barva_RGB.png" alt="ČZU PEF" height="80" />
  </div>

  <h1 style="font-family: Poppins, sans-serif; color: #b31b1b; font-weight: 800; font-size: 2.5rem; margin: 0.5rem 0;">
    Tappka
  </h1>

  <p style="font-family: Roboto, sans-serif; color: #555; font-size: 1rem; max-width: 480px; margin: 0.5rem auto;">
    All-in-one web app for <strong>Tiimiakatemia Prague</strong> — empowering teams with room booking, essay bank, and authentication.
  </p>

  <p style="font-family: Roboto, sans-serif; color: #2c1a1d; font-size: 0.85rem; margin-top: 1.5rem;">
    Made with ❤️ by
    <a href="https://www.linkedin.com/in/ond%C5%99ej-schlossar/" style="color: #b31b1b; text-decoration: none;">Ondřej Schlossar</a>,
    <a href="https://www.linkedin.com/in/ondrejkulhavy/" style="color: #b31b1b; text-decoration: none;">Ondřej Kulhavý</a>,
    <a href="https://www.linkedin.com/in/tomprotiva/" style="color: #b31b1b; text-decoration: none;">Tomáš Protiva</a>
  </p>
</div>

# Links

## Publicly available

- [Tappka](https://tiimi.cz)
- [Tappka preview](https://preview.tiimi.cz)

## Locally available when running the project

- [Tappka locally](http://localhost:3000)
- [Supabase locally](http://localhost:54323)
- [Supabase mail locally](http://localhost:54324)

## Other links

- [Blacksmith](https://app.blacksmith.sh/tiimiakatemiapragueit/runs/jobs) - CI/CD for the project
- [Supabase](https://supabase.comorg/zjdqjjekgwwysjkouxpf) - Database for the project
- [Vercel](https://vercel.com/spirit-of-taps-projects/tappka) - Hosting for the project
- [Cloudflare DNS](https://dash.cloudflare.com/09d0b565479ef597d4c1bfa2062078b5/tiimi.cz/dns/records) - DNS for the project
- [Axiom](https://app.axiom.co/spirit-of-tap-9eje) - Logging for the project

# Language

The project is written in english and will be written in english for better llm compatibility.
All czech should be just in localization files.

# Local Development

## Setup

1. Install git if already not installed - https://git-scm.com/install/

```powershell
winget install -e --id Git.Git
```

```bash
brew install git
```

2. Install mise if already not installed - https://mise.jdx.dev/installing-mise.html

MACOS

```bash
curl https://mise.run/zsh | sh
```

WINDOWS

```powershell
winget install jdx.mise
```

3. Setup mise - https://mise.jdx.dev/getting-started.html

```bash
mise install
mise doctor
```

4. On MACOS docker gets installed automatically by mise. On Windows you need to install it manually - https://docs.docker.com/get-docker/

```powershell
winget install -e --id Docker.DockerDesktop
```

5. Clone the repository

```bash
git clone https://github.com/tappka/tappka.git
```

6. Navigate to the project directory -

```bash
cd tappka
```

## Running the project after setup

```bash
pnpm install
pnpm dev
```

The project will be available at [http://localhost:3000](http://localhost:3000)

Other commands:

```bash
pnpm dev # Runs the project in development mode. Starts the supabase docker instance (which will not turn off even when you ctrl+c)
pnpm stop # Stops the supabase docker instance
pnpm restart # Stops the supabase docker instance and runs dev again
```

For guidelines on how to develop the project see [CONTRIBUTING.md](CONTRIBUTING.md).

# Supabase

Supabase database is developed locally and synced automatically whenever pushed. See [.github/workflows/deploy-supabase.yml](.github/workflows/deploy-supabase.yml) for more details.
Supabase Auth needs to be configured both on the project itself and in the local development environment.
Make sure that the project can run without setting up any environment variables, this is so that we can get new T's to start vibecoding without them giving up.

In case there is a conflict on the preview branch, the github action will reset the database and push the changes again. Therefore **do not store anything important in the preview database**.

# Recommended Tools

It is very nice to setup mcp with cursor for supabase. Look at [Supabase locally](http://localhost:54323) and go to the top for connection button. It will give you the option.
There are cursor rules made for this nextjs project.

# Publishing the project to the public

You can simply **push to the preview branch** and it will be deployed to the preview environment.
For production you will need to make a **pull request to the production branch** and it will be deployed to the production environment. You can approve it yourself, it's just for protection so that you don't accidentally deploy something to production.

```

```
