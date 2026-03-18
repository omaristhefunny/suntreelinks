# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes a Discord bot for managing unblocked school links and a shared Express API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord**: discord.js v14

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── discord-bot/        # Discord bot (slash commands for link management)
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Discord Bot (`artifacts/discord-bot`)

Manages unblocked website links categorized by 19 school content filters.

### Commands
- `/add` — Admin-only. Adds a new link with filter bypass options.
- `/link` — Find links that bypass a specific filter (dropdown select).
- `/remove` — Admin-only. Remove a link by name or URL.
- `/list` — List all saved links (paginated, 10 per page).
- `/filters` — List all 19 supported school filters.

### Supported Filters
FortiGuard, Lightspeed, Palo Alto, Blocksi Web, Blocksi AI, Linewize, Cisco Umbrella, Securly, GoGuardian, LanSchool, ContentKeeper, AristotleK12, Senso Cloud, Deledao, iBoss, Sophos, Barracuda, Qustodio, DNSFilter

### Scripts
- `pnpm --filter @workspace/discord-bot run dev` — Start the bot
- `pnpm --filter @workspace/discord-bot run deploy-commands` — Re-register slash commands with Discord

### Required Secrets
- `DISCORD_BOT_TOKEN` — Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application ID from Discord Developer Portal

## Database Schema (`lib/db/src/schema/links.ts`)

Table: `links`
- `id`, `name`, `url` (unique), `added_by`, `created_at`
- One boolean column per filter (19 total)

Run migrations: `pnpm --filter @workspace/db run push`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- Run `pnpm run typecheck` for full type checking
- `emitDeclarationOnly` — only `.d.ts` files emitted; JS handled by tsx/esbuild

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — full typecheck with project references
