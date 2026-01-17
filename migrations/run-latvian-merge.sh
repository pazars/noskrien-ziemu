#!/bin/bash
# Script to run the Latvian duplicate merge migration via Worker endpoint
# This uses the Worker API instead of direct SQL execution to avoid D1 restrictions

set -e

API_URL="${API_URL:-http://localhost:8787}"

echo "=== Latvian Duplicate Merge Migration ==="
echo "API URL: $API_URL"
echo ""
echo "This will merge duplicate participant names, keeping Latvian special character versions"
echo ""

# Step 1: Preview the changes
echo "Step 1: Previewing what will be merged..."
echo ""

PREVIEW=$(curl -s -X POST "$API_URL/api/migrate/latvian-duplicates?preview=true")

# Check if curl succeeded
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to connect to API. Is the worker running?"
    echo "Run: wrangler dev --remote"
    exit 1
fi

# Check for errors in response
if echo "$PREVIEW" | grep -q '"error"'; then
    echo "ERROR from API:"
    echo "$PREVIEW" | jq '.'
    exit 1
fi

# Display preview
echo "$PREVIEW" | jq '.'
echo ""

# Get counts
TOTAL_MERGES=$(echo "$PREVIEW" | jq -r '.totalMerges')
UNIQUE_KEEPERS=$(echo "$PREVIEW" | jq -r '.uniqueKeepers')

echo "Summary:"
echo "  - Will merge: $TOTAL_MERGES duplicate records"
echo "  - Into: $UNIQUE_KEEPERS unique participants"
echo ""

if [ "$TOTAL_MERGES" -eq 0 ]; then
    echo "No duplicates found. Migration not needed."
    exit 0
fi

# Show some examples
echo "Examples of merges (first 10):"
echo "$PREVIEW" | jq -r '.actions[:10] | .[] | "  \(.oldName) → \(.newName) (season \(.season))"'
echo ""

# Step 2: Confirm and execute
read -p "Apply these changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 1
fi

echo ""
echo "Step 2: Executing migration..."
echo ""

RESULT=$(curl -s -X POST "$API_URL/api/migrate/latvian-duplicates")

# Check for errors
if echo "$RESULT" | grep -q '"error"'; then
    echo "ERROR during migration:"
    echo "$RESULT" | jq '.'
    exit 1
fi

# Display result
echo "$RESULT" | jq '.'
echo ""

# Get final counts
SUCCESS=$(echo "$RESULT" | jq -r '.success')
UPDATED_RACES=$(echo "$RESULT" | jq -r '.updatedRaces')
DELETED_PARTICIPANTS=$(echo "$RESULT" | jq -r '.deletedParticipants')

if [ "$SUCCESS" = "true" ]; then
    echo "✓ Migration completed successfully!"
    echo "  - Updated $UPDATED_RACES race records"
    echo "  - Deleted $DELETED_PARTICIPANTS duplicate participants"
else
    echo "✗ Migration failed"
    exit 1
fi
