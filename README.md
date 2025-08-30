# Battleship

This classical Battleship game is to experiment building turn-based game and AI agents with [LiveStore](https://livestore.dev/)

## Demo
[Live Demo](https://web-todomvc-sync-cf.livestore.dev)

## Architecture

With Livestore, the game state is syncrhonize across both browser / node clients, with Cloudflare workers (across session/ browsers)
The Node [serve-rside client](https://docs.livestore.dev/reference/syncing/server-side-clients/) is responsible for confirming action for turn and pick next player.

## Repo Structure

This is a monorepo containing:

### Applications
- **web-app**: React frontend application on https://battleship-webapp.pages.dev
- **server-client**: Game server and Node client logic
- **cf-worker**: Cloudflare Worker for synchronization (Ref: https://docs.livestore.dev/reference/syncing/sync-provider/cloudflare/)

### Packages
- **domain**: Isomorphic game logic
- **schema**: Livestore schema and queries
  - Note: currently a copy of schema is kept at webapp due to build error


## Deployment

Currently the sync worker is deployed as Cloudflare Worker
Server client is deployed at Render on https://battleship-server-client.onrender.com/


### Prerequisites

- Node.js
- pnpm
- wrangler

### Installation

```bash
pnpm install
```

### Running locally

```bash
# Start all services in development mode
pnpm dev

# Or run specific services
pnpm run dev:webapp
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm run build:webapp
```

### Testing & Linting

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type checking
pnpm typecheck
```

### Deployment

```bash
# Deploy all services
pnpm deploy

# Deploy specific service
pnpm deploy:webapp
pnpm deploy:server-client
```

## Project Structure

```
apps/
├── web-app/          # React frontend
├── server-client/    # Game server logic
├── cf-worker/        # Cloudflare Worker
└── cf-worker-api/    # API endpoints
packages/             # Shared packages
```