#!/bin/bash
# Script to run the Latvian duplicate merge migration
# This uses wrangler to execute SQL against the remote D1 database

echo "=== Latvian Duplicate Merge Migration ==="
echo "This will merge duplicate participant names, keeping Latvian special character versions"
echo ""
echo "Note: This requires wrangler to be configured with access to your D1 database"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# First, let's identify the duplicates
echo ""
echo "Identifying duplicates..."
wrangler d1 execute noskrien-ziemu-db --remote --command "
WITH normalized AS (
  SELECT
    id,
    name,
    LOWER(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        name,
        'ā', 'a'),
        'č', 'c'),
        'ē', 'e'),
        'ģ', 'g'),
        'ī', 'i'),
        'ķ', 'k'),
        'ļ', 'l'),
        'ņ', 'n'),
        'š', 's'),
        'ū', 'u'),
        'ž', 'z')
    ) as normalized_name,
    season,
    distance,
    gender,
    LENGTH(name) as name_length
  FROM participants
)
SELECT
  n1.name as 'Non-Latvian',
  n2.name as 'Latvian',
  n1.season,
  n1.id as 'Delete ID',
  n2.id as 'Keep ID'
FROM normalized n1
JOIN normalized n2 ON
  n1.normalized_name = n2.normalized_name
  AND n1.season = n2.season
  AND n1.distance = n2.distance
  AND n1.gender = n2.gender
  AND n1.id != n2.id
  AND n1.name_length < n2.name_length
ORDER BY n2.name;
"

echo ""
echo "If the above looks correct, the migration will now proceed."
read -p "Apply these changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Migration cancelled"
    exit 1
fi

echo "Note: The actual JavaScript-based merge needs to be implemented as a Worker endpoint"
echo "The SQL approach above is for preview only. Please use the JavaScript migration script."
