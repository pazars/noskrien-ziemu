-- Migration: Merge duplicate names, keeping Latvian special character versions
-- This script identifies participant records that differ only by Latvian special characters
-- and consolidates them by keeping the version with Latvian characters.

-- Create a temporary table to store the normalization mapping
CREATE TEMP TABLE name_mappings AS
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
    gender
  FROM participants
),
-- Find groups where normalized names match
grouped AS (
  SELECT
    normalized_name,
    season,
    distance,
    gender,
    -- Prefer the name with Latvian characters (longer byte length for same char count)
    MIN(id) as keep_id,
    GROUP_CONCAT(id) as all_ids
  FROM normalized
  GROUP BY normalized_name, season, distance, gender
  HAVING COUNT(*) > 1
)
SELECT
  p.id as old_id,
  g.keep_id as new_id,
  p.name as old_name,
  keeper.name as new_name
FROM grouped g
JOIN normalized p ON
  p.normalized_name = g.normalized_name
  AND p.season = g.season
  AND p.distance = g.distance
  AND p.gender = g.gender
JOIN participants keeper ON keeper.id = g.keep_id
WHERE p.id != g.keep_id;

-- Show what will be merged (for review)
SELECT
  old_name as 'Will merge',
  new_name as 'Into',
  old_id,
  new_id
FROM name_mappings
ORDER BY new_name;

-- Update race records to point to the keeper participant
UPDATE races
SET participant_id = (
  SELECT new_id
  FROM name_mappings
  WHERE name_mappings.old_id = races.participant_id
)
WHERE participant_id IN (SELECT old_id FROM name_mappings);

-- Delete duplicate participant records
DELETE FROM participants
WHERE id IN (SELECT old_id FROM name_mappings);

-- Show summary
SELECT
  COUNT(DISTINCT old_id) as 'Merged records',
  COUNT(DISTINCT new_id) as 'Kept records'
FROM name_mappings;
