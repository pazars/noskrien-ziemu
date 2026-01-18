# Claude Code Guidelines for Noskrien Ziemu Project

This document outlines specific workflows, commands, and best practices for working on this project with Claude Code.

## Development Commands

### 1. Database API Setup (Cloudflare Pages)
```bash
npm run build && wrangler pages dev dist --d1 DB=noskrien-ziemu --remote --port 8787
```
- **Purpose**: Starts Cloudflare Pages dev server with remote D1 database access
- **Port**: 8787
- **Note**: Requires building the frontend first (`npm run build`)
- **Important**: The `--remote` flag connects to the actual production D1 database
- **Alternative**: Use `--live-reload` flag for auto-rebuild on changes
- **⚠️ Important**: If port is taken, the process is already running - do NOT create a new one

### 2. UI Development Server
```bash
npm run dev
```
- **Purpose**: Starts Vite dev server for frontend testing
- **Port**: 5173
- **⚠️ Important**: If port is taken, the process is already running - do NOT create a new one

### 3. Process Management
- **DO NOT** create new db api or ui processes without explicit permission
- If a process is blocking work, **ASK** for permission to kill processes
- Check if ports 8787 or 5173 are in use before attempting to start services

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
