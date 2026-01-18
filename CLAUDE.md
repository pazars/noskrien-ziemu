# Claude Code Guidelines for Noskrien Ziemu Project

This document outlines specific workflows, commands, and best practices for working on this project with Claude Code.

## Development Commands

### Quick Start
```bash
npm run dev       # Frontend only (uses production API)
npm run dev:api   # Full stack (local API + DB)
```

### 1. Frontend Development (Recommended)
```bash
npm run dev
```
- **Purpose**: UI development with hot-reload
- **Port**: 5173 (http://localhost:5173)
- **API**: Uses production at https://noskrien-ziemu.pages.dev
- **Use this for**: Component development, UI/UX work

### 2. Full Stack Development (Local API + D1)
```bash
npm run dev:api
```
- **Purpose**: Local API with D1 database
- **Port**: 8787 (http://localhost:8787)
- **What it does**: Builds frontend and starts `wrangler pages dev`
- **Use this for**: API changes, database testing
- **Pro tip**: Run `npm run dev` in another terminal for UI hot-reload

#### First Time Database Setup
The local D1 database persists automatically (wrangler v3+). Set it up once:

```bash
# Apply schema
wrangler d1 execute noskrien-ziemu --local --file=schema-v2.sql

# Import data
npx tsx scripts/pipeline/3-generate-sql.ts ./data import_local.sql
wrangler d1 execute noskrien-ziemu --local --file=import_local.sql
```

This populates ~5,424 participants and ~22,494 races. Data persists across restarts.

#### Resetting Local Database
To clear and start fresh:
```bash
# Delete persisted data
rm -rf .wrangler/state/v3/d1

# Then re-run setup commands above
```

### 3. Process Management
- If port is blocked, kill manually: `pkill -f "wrangler\|vite"`

## Workflow Guidelines

### UI Design Changes
Use the `/frontend-design` skill to:
- Ideate UI/UX improvements
- Implement design changes
- Ensure consistency with existing design patterns

### Playwright Browser Testing
- **Be time-conscious** when using Playwright MCP
- Sometimes manual testing and user feedback is more efficient
- Use Playwright for:
  - Complex interaction flows
  - Automated regression testing
  - Scenarios difficult to test manually

### Planning & Execution

#### Complex Tasks
Use `/superpowers:writing-plans` to create an execution plan when:
- Working on complex, multi-step tasks
- Multiple tasks are assigned at once
- Architectural changes are needed

Then use `/superpowers:executing-plans` to execute the plan with proper checkpoints.

### Testing Requirements
After implementing changes or fixing bugs:
- **Minimum**: Add a few tests covering the changes
- **Ideal**: Include integration/e2e tests
- **Note**: Superpowers execution should handle this automatically during plan execution

### Code Refactoring
When asked to refactor or simplify code:
- Use `/code-simplifier` skill
- Focus on clarity and maintainability
- Preserve existing functionality

## Project-Specific Notes

### Architecture
- **Database**: Cloudflare D1 (remote)
- **API**: Cloudflare Pages Functions (`functions/api/[[path]].ts`)
- **Legacy Worker**: `worker/index.ts` (kept for reference, not used in production)
- **Frontend**: React + Vite + Tailwind CSS
- **Charts**: Recharts library

### Data Structure
- Two main tables: `participants` and `races`
- ~15,673 race records across seasons 2017-2026
- Seasons 2020-2021 and 2021-2022 missing (404 errors)

### Key Files
- `functions/api/[[path]].ts`: API endpoints (Cloudflare Pages Functions)
- `worker/index.ts`: Legacy worker file (not used in production)
- `src/components/ParticipantSelector.tsx`: Search autocomplete
- `src/components/RaceComparison.tsx`: Comparison visualization
- `src/utils/comparison.ts`: Head-to-head matching logic
- `wrangler.toml`: Cloudflare Pages configuration

## Data Pipeline Commands

### Adding a New Season

When new race results are available:

```bash
# 1. Scrape the season (if not already done)
npx tsx scripts/scrape.ts 2026-2027

# 2. Sync to database (normalize + generate SQL + import)
npm run pipeline:sync 2026-2027
```

This will:
- Normalize data and merge duplicates
- Generate idempotent SQL
- Import to production database
- Verify import counts

### Rebuilding Database from Scratch

⚠️ **Destructive operation** - only use for schema changes or data corruption recovery:

```bash
npm run pipeline:rebuild
```

This will:
- Prompt for confirmation and optional backup
- Apply schema-v2.sql
- Normalize all historical data
- Generate and import fresh SQL
- Verify integrity

### Manual Pipeline Steps

For debugging or custom workflows:

```bash
# Normalize only
npm run pipeline:normalize

# Generate SQL only
npm run pipeline:generate-sql

# Or run scripts directly
npx tsx scripts/pipeline/2-normalize-data.ts ./data
npx tsx scripts/pipeline/3-generate-sql.ts ./data import_data.sql
wrangler d1 execute noskrien-ziemu --remote --file=import_data.sql --yes
```

See [scripts/pipeline/README.md](scripts/pipeline/README.md) for detailed documentation.

## Best Practices

1. **Read before modifying**: Always read existing code before making changes
2. **Stick to existing patterns**: Follow established code patterns in the project
3. **Test coverage**: Ensure changes have corresponding tests
4. **Port awareness**: Check if services are running before starting new instances
5. **Ask when uncertain**: Request permission for potentially disruptive actions
