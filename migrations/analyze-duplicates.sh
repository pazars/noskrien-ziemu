#!/bin/bash
# Script to analyze potential Latvian character duplicates in the database

API_URL="${API_URL:-http://localhost:8787}"

echo "=== Analyzing Latvian Duplicate Candidates ==="
echo ""

# Get all participants and analyze them client-side
echo "Fetching all participants..."

# Use the existing API to get a sample of names
# We'll search for common Latvian surnames to see if we find duplicates

common_names=(
    "Berzins"
    "Liepins"
    "Kronberga"
    "Ruttulis"
    "Kopasova"
)

echo "Searching for potential duplicates with common names..."
echo ""

for name in "${common_names[@]}"; do
    echo "Searching for: $name"
    curl -s "$API_URL/api/results?name=$name" | jq -r '.[] | "\(.name) (\(.gender))"' | sort -u
    echo ""
done

echo ""
echo "Getting full migration preview..."
curl -s -X POST "$API_URL/api/migrate/latvian-duplicates?preview=true" | jq '.'
