# Tappka

Tappka as the app all-in-one web app for Tiimiakatemia Prague.

## Features

- [ ] Authentication
- [ ] Room booking
- [ ] Essay Bank

# Language

The project is written in english and will be written in english for better llm compatibility.
All czech should be just in localization files.

# Local Development

## Setup

1. Install git if already not installed - https://git-scm.com/install/
2. Install node.js v24.x with pnpm 10.x if already not installed - https://nodejs.org/en/download/
3. Install pnpm v10.x if you didn't choose it in the previous step

```bash
npm install -g pnpm@10.28.1
```

4. Clone the repository 
```bash
git clone https://github.com/tappka/tappka.git
```
5. Navigate to the project directory - 
```bash
cd tappka
```

## Running the project after setup

```bash
pnpm install && pnpm dev
```

The project will be available at [http://localhost:3000](http://localhost:3000)
