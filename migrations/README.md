# Database Migration: Merge Latvian Character Duplicates

## Problem
The database contains duplicate participant records where names differ only by Latvian special characters:
- Example: "Kristaps Berzins" vs "Kristaps Bērziņš"

## Solution
This migration merges such duplicates, keeping the version with Latvian special characters (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž).

## Files
- `merge-latvian-duplicates.js` - JavaScript migration logic
- `merge-latvian-duplicates.sql` - SQL-based approach (for reference)

## How to Run

### Option 1: Via Cloudflare Dashboard
1. Deploy the JavaScript migration as a temporary Worker endpoint
2. Access the endpoint to trigger the migration
3. Remove the endpoint after completion

### Option 2: Via wrangler d1 execute
Execute the SQL commands in `merge-latvian-duplicates.sql` using:
```bash
wrangler d1 execute noskrien-ziemu-db --remote --file=migrations/merge-latvian-duplicates.sql
```

### Option 3: Integrate into Worker (Recommended for testing)
Add the merge logic to your worker temporarily and call it via a protected endpoint.

## Important Notes
- **Backup**: The data is already backed up as mentioned in the requirements
- **Testing**: Test on a local/development database first if possible
- **Races**: All race records will be automatically updated to reference the kept participant
- **Cascading**: Duplicate participant records will be deleted after race reassignment
