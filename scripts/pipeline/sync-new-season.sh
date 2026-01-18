#!/bin/bash
# Sync new season data to database
# Usage: ./scripts/pipeline/sync-new-season.sh [season]
#
# Steps:
#   1. [Optional] Scrape new season data
#   2. Normalize data (merge duplicates)
#   3. Generate idempotent SQL
#   4. Import to database (with confirmation)

set -e

SEASON=${1:-""}
DATA_DIR="data"
SQL_FILE="import_data.sql"

echo "=== Sync New Season to Database ==="
echo ""

# Validate season format if provided
if [ -n "$SEASON" ]; then
  if [[ ! $SEASON =~ ^[0-9]{4}-[0-9]{4}$ ]]; then
    echo "❌ Error: Season must be in format YYYY-YYYY (e.g., 2026-2027)"
    exit 1
  fi
  echo "Target season: $SEASON"
  SEASON_DIR="$DATA_DIR/$SEASON"

  if [ ! -d "$SEASON_DIR" ]; then
    echo ""
    echo "Season directory not found: $SEASON_DIR"
    read -p "Do you want to scrape this season first? (yes/no) " -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
      echo "Please run the scraper manually:"
      echo "  npx tsx scripts/scrape.ts $SEASON"
      echo ""
      echo "Then re-run this script."
      exit 0
    else
      echo "Cannot proceed without season data. Exiting."
      exit 1
    fi
  fi
else
  echo "No specific season specified - will process all data"
fi

echo ""
echo "Pipeline steps:"
echo "  1. Normalize data (merge duplicates, add normalized_name)"
echo "  2. Generate idempotent SQL (safe to run multiple times)"
echo "  3. Import to database"
echo ""

# Step 1: Normalize data
echo "Step 1: Normalizing data..."
echo ""
npx tsx scripts/pipeline/2-normalize-data.ts "$DATA_DIR"

if [ $? -ne 0 ]; then
  echo "❌ Normalization failed"
  exit 1
fi

# Step 2: Generate SQL
echo ""
echo "Step 2: Generating SQL..."
echo ""
npx tsx scripts/pipeline/3-generate-sql.ts "$DATA_DIR" "$SQL_FILE"

if [ $? -ne 0 ]; then
  echo "❌ SQL generation failed"
  exit 1
fi

# Check SQL file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Error: $SQL_FILE not found"
  exit 1
fi

FILE_SIZE=$(ls -lh "$SQL_FILE" | awk '{print $5}')
echo ""
echo "Generated SQL file: $SQL_FILE ($FILE_SIZE)"
echo ""

# Step 3: Import to database (with confirmation)
echo "Step 3: Import to database"
echo ""
echo "⚠️  This will modify the remote D1 database."
echo "   The SQL is idempotent (safe to run multiple times)."
echo "   Existing records will be updated, new records will be inserted."
echo ""
read -p "Continue with import? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Import cancelled. SQL file available at: $SQL_FILE"
  exit 0
fi

echo "Importing to remote database..."
echo ""
wrangler d1 execute noskrien-ziemu --remote --file="$SQL_FILE" --yes

echo ""
echo "Step 4: Verifying import..."
echo ""

# Verify counts
PARTICIPANT_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM participants" --yes 2>&1 | grep -oP '"count":\s*\K\d+' || echo "0")
RACE_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM races" --yes 2>&1 | grep -oP '"count":\s*\K\d+' || echo "0")

echo "Current database counts:"
echo "  Participants: $PARTICIPANT_COUNT"
echo "  Races: $RACE_COUNT"
echo ""
echo "✓ Import complete!"
echo ""
echo "Next steps:"
echo "  1. Verify the data in the UI (npm run dev)"
echo "  2. Check for any anomalies in the data"
echo ""
