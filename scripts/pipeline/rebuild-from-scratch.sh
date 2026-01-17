#!/bin/bash
# Rebuild database from scratch
# Usage: ./scripts/pipeline/rebuild-from-scratch.sh
#
# ⚠️  WARNING: This is a destructive operation!
#
# Steps:
#   1. Backup current database (optional but recommended)
#   2. Apply schema-v2.sql (drops and recreates tables)
#   3. Normalize all data
#   4. Generate SQL
#   5. Import to database
#   6. Verify counts

set -e

DATA_DIR="data"
SQL_FILE="import_data.sql"
SCHEMA_FILE="schema-v2.sql"

echo "=== Rebuild Database from Scratch ==="
echo ""
echo "⚠️  WARNING: This will DELETE ALL data in the database!"
echo ""
echo "Pipeline steps:"
echo "  1. [Optional] Backup current database"
echo "  2. Apply schema (DROP and CREATE tables)"
echo "  3. Normalize all data (merge duplicates)"
echo "  4. Generate SQL"
echo "  5. Import to database"
echo "  6. Verify counts"
echo ""

# Confirm destructive operation
read -p "Are you sure you want to rebuild the database? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Rebuild cancelled"
  exit 0
fi

# Step 1: Backup (optional)
echo ""
echo "Step 1: Backup current database"
echo ""
read -p "Do you want to backup the current database first? (yes/no) " -r
echo

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
  echo "Creating backup: $BACKUP_FILE"
  echo ""

  # Export participants
  echo "Exporting participants..."
  wrangler d1 execute noskrien-ziemu --remote --command "SELECT * FROM participants" --yes > "$BACKUP_FILE.participants.json" 2>&1 || true

  # Export races
  echo "Exporting races..."
  wrangler d1 execute noskrien-ziemu --remote --command "SELECT * FROM races" --yes > "$BACKUP_FILE.races.json" 2>&1 || true

  echo "✓ Backup created (limited export - D1 doesn't support full SQL dumps)"
  echo "  Note: This is a JSON export, not a full SQL backup"
  echo ""
fi

# Step 2: Apply schema
echo "Step 2: Applying schema..."
echo ""

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "❌ Error: Schema file not found: $SCHEMA_FILE"
  exit 1
fi

echo "⚠️  Last chance to cancel before data is deleted!"
read -p "Apply schema and DROP all tables? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Rebuild cancelled"
  exit 0
fi

echo "Applying schema to remote database..."
wrangler d1 execute noskrien-ziemu --remote --file="$SCHEMA_FILE" --yes

echo ""
echo "✓ Schema applied (all tables dropped and recreated)"
echo ""

# Step 3: Normalize data
echo "Step 3: Normalizing data..."
echo ""
npx tsx scripts/pipeline/2-normalize-data.ts "$DATA_DIR"

if [ $? -ne 0 ]; then
  echo "❌ Normalization failed"
  exit 1
fi

# Step 4: Generate SQL
echo ""
echo "Step 4: Generating SQL..."
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

# Step 5: Import to database
echo "Step 5: Importing to database..."
echo ""
wrangler d1 execute noskrien-ziemu --remote --file="$SQL_FILE" --yes

echo ""
echo "✓ Data imported"
echo ""

# Step 6: Verify counts
echo "Step 6: Verifying import..."
echo ""

PARTICIPANT_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM participants" --yes 2>&1 | grep -oP '"count":\s*\K\d+' || echo "0")
RACE_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM races" --yes 2>&1 | grep -oP '"count":\s*\K\d+' || echo "0")

echo "Final database counts:"
echo "  Participants: $PARTICIPANT_COUNT"
echo "  Races: $RACE_COUNT"
echo ""

if [ "$PARTICIPANT_COUNT" -gt 0 ] && [ "$RACE_COUNT" -gt 0 ]; then
  echo "✓ Database rebuild complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Verify the data in the UI (npm run dev)"
  echo "  2. Run integration tests if available"
  echo "  3. Check for any data anomalies"
else
  echo "⚠️  Warning: Unexpected counts (some may be zero)"
  echo "   Please verify the data manually"
fi
echo ""
