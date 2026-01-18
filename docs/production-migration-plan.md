# Production Migration Plan

**Date:** 2026-01-18
**Database:** noskrien-ziemu (production)
**Strategy:** Clean Slate (Drop & Recreate)
**Expected Downtime:** ~5 minutes

## Pre-Migration Checklist

- [x] Local testing completed successfully
- [x] Test database verified: 5,424 participants, 22,494 races
- [x] All tests passing
- [x] Idempotency confirmed
- [x] Gender detection bug fixed
- [x] All code committed to feature branch

## Migration Steps

### Step 1: Create Backup (Optional)

Since D1 doesn't support full SQL dumps, we'll export data as JSON for reference.

```bash
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM participants"
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM races"
```

### Step 2: Apply New Schema

```bash
wrangler d1 execute noskrien-ziemu --remote --file=schema-v2.sql --yes
```

This will:
- Drop existing tables (participants, races)
- Create new tables with updated structure
- Add 4 optimized indexes

### Step 3: Generate Fresh SQL from Normalized Data

```bash
npm run pipeline:normalize
npm run pipeline:generate-sql
```

### Step 4: Import to Production

```bash
wrangler d1 execute noskrien-ziemu --remote --file=import_data.sql --yes
```

### Step 5: Verify Data

```bash
# Check counts
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM participants"
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM races"

# Verify data integrity
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM participants WHERE normalized_name IS NULL"
wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) FROM races WHERE season IS NULL"
```

Expected results:
- Participants: 5,424
- Races: 22,494
- NULL normalized_name: 0
- NULL season: 0

### Step 6: Test API Endpoints

Test the updated API endpoints:
- `/api/results?name=pazars&distance=Tautas` - autocomplete search
- `/api/history?id=1` - participant history by ID

### Step 7: Test Frontend

- Start dev server: `npm run dev`
- Test autocomplete search
- Test race comparison
- Verify performance improvements

## Rollback Plan

If migration fails:

```bash
# Restore from main branch
git checkout main
wrangler d1 execute noskrien-ziemu --remote --file=schema.sql --yes
# Re-import old data (if backup available)
```

## Success Criteria

- [ ] All 5,424 participants imported
- [ ] All 22,494 races imported
- [ ] No NULL normalized_name fields
- [ ] No NULL season fields
- [ ] API `/api/results` returns search results
- [ ] API `/api/history` returns participant data by ID
- [ ] Frontend autocomplete works
- [ ] Frontend race comparison works
- [ ] No console errors

## Post-Migration Tasks

- [ ] Update AGENTS.md with migration completion
- [ ] Clean up temporary files (import_data_test*.sql)
- [ ] Delete test database (optional)
- [ ] Merge feature branch to main
- [ ] Delete worktree
- [ ] Update CLAUDE.md with new pipeline commands
