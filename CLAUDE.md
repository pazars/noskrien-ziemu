# Claude Code Guidelines for Noskrien Ziemu Project

This document outlines specific workflows, commands, and best practices for working on this project with Claude Code.

## Development Commands

### 1. Database API Setup
```bash
wrangler dev --remote
```
- **Purpose**: Starts Cloudflare Worker with remote D1 database access
- **Port**: 8787
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
- **API**: Cloudflare Workers (`worker/index.ts`)
- **Frontend**: React + Vite + Tailwind CSS
- **Charts**: Recharts library

### Data Structure
- Two main tables: `participants` and `races`
- ~15,673 race records across seasons 2017-2026
- Seasons 2020-2021 and 2021-2022 missing (404 errors)

### Key Files
- `worker/index.ts`: API endpoints
- `src/components/ParticipantSelector.tsx`: Search autocomplete
- `src/components/RaceComparison.tsx`: Comparison visualization
- `src/utils/comparison.ts`: Head-to-head matching logic
- `wrangler.toml`: Cloudflare Worker configuration

## Best Practices

1. **Read before modifying**: Always read existing code before making changes
2. **Stick to existing patterns**: Follow established code patterns in the project
3. **Test coverage**: Ensure changes have corresponding tests
4. **Port awareness**: Check if services are running before starting new instances
5. **Ask when uncertain**: Request permission for potentially disruptive actions
