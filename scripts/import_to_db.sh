#!/bin/bash
# Script to safely import combined Tautas + Sporta data to D1 database

set -e

echo "=== Database Import Script ==="
echo ""
echo "This will:"
echo "  1. Clear existing data (participants and races)"
echo "  2. Import combined Tautas + Sporta data (6,337 participants, 16,245 races)"
echo ""

# Check if import_data.sql exists
if [ ! -f "import_data.sql" ]; then
    echo "❌ Error: import_data.sql not found"
    echo "Please run: npx tsx scripts/generate_sql.ts"
    exit 1
fi

# Check file size
FILE_SIZE=$(ls -lh import_data.sql | awk '{print $5}')
echo "SQL file size: $FILE_SIZE"
echo ""

# Confirm with user
read -p "⚠️  This will DELETE all existing data. Continue? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Import cancelled"
    exit 1
fi

echo ""
echo "Step 1: Clearing existing data..."
echo ""

# Clear existing data
wrangler d1 execute noskrien-ziemu --remote --command "DELETE FROM races; DELETE FROM participants;" --yes

echo ""
echo "✓ Data cleared"
echo ""
echo "Step 2: Importing new data (this may take a few minutes)..."
echo ""

# Import new data
wrangler d1 execute noskrien-ziemu --remote --file=import_data.sql --yes

echo ""
echo "Step 3: Verifying import..."
echo ""

# Verify counts
PARTICIPANT_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM participants" --yes 2>&1 | grep -A 1 '"count":' | tail -1 | grep -o '[0-9]*')
RACE_COUNT=$(wrangler d1 execute noskrien-ziemu --remote --command "SELECT COUNT(*) as count FROM races" --yes 2>&1 | grep -A 1 '"count":' | tail -1 | grep -o '[0-9]*')

echo "Participants imported: $PARTICIPANT_COUNT (expected: 6337)"
echo "Races imported: $RACE_COUNT (expected: 16245)"
echo ""

if [ "$PARTICIPANT_COUNT" -eq 6337 ] && [ "$RACE_COUNT" -eq 16245 ]; then
    echo "✓ Import successful!"
    echo ""
    echo "Next steps:"
    echo "  1. Run the Latvian merge migration to clean up duplicates:"
    echo "     ./migrations/run-latvian-merge.sh"
    echo ""
    echo "  2. Verify the data in the UI"
else
    echo "⚠️  Import completed but counts don't match expected values"
    echo "Please verify the data manually"
fi
