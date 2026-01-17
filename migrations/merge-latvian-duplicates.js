/**
 * Migration Script: Merge duplicate participant names
 *
 * This script finds participants whose names differ only by Latvian special characters
 * (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž) and merges them, keeping the Latvian version.
 *
 * Usage: Run this against your D1 database using wrangler or a similar tool
 */

// Normalize a name by replacing Latvian characters with ASCII equivalents
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/ā/g, 'a')
    .replace(/č/g, 'c')
    .replace(/ē/g, 'e')
    .replace(/ģ/g, 'g')
    .replace(/ī/g, 'i')
    .replace(/ķ/g, 'k')
    .replace(/ļ/g, 'l')
    .replace(/ņ/g, 'n')
    .replace(/š/g, 's')
    .replace(/ū/g, 'u')
    .replace(/ž/g, 'z');
}

// Check if a name contains Latvian special characters
function hasLatvianChars(name) {
  return /[āčēģīķļņšūž]/i.test(name);
}

export async function mergeDuplicates(db) {
  console.log('Starting duplicate merge process...');

  // Get all participants
  const { results: participants } = await db.prepare(
    'SELECT id, name, season, distance, gender FROM participants ORDER BY name'
  ).all();

  console.log(`Found ${participants.length} participants`);

  // Group by normalized name + season + distance + gender
  const groups = new Map();

  for (const p of participants) {
    const key = `${normalizeName(p.name)}|${p.season}|${p.distance}|${p.gender}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(p);
  }

  // Find duplicates and determine which to keep
  const mergeOperations = [];

  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      // Prefer the version with Latvian characters
      const latvianVersion = group.find(p => hasLatvianChars(p.name));
      const keepId = latvianVersion ? latvianVersion.id : group[0].id;
      const keepName = latvianVersion ? latvianVersion.name : group[0].name;

      for (const p of group) {
        if (p.id !== keepId) {
          mergeOperations.push({
            oldId: p.id,
            oldName: p.name,
            newId: keepId,
            newName: keepName
          });
        }
      }
    }
  }

  console.log(`Found ${mergeOperations.length} duplicates to merge`);

  if (mergeOperations.length === 0) {
    console.log('No duplicates found!');
    return;
  }

  // Display what will be merged
  console.log('\nMerge operations:');
  mergeOperations.forEach(op => {
    console.log(`  "${op.oldName}" (id:${op.oldId}) -> "${op.newName}" (id:${op.newId})`);
  });

  // Perform the merge
  for (const op of mergeOperations) {
    // Update races to point to the keeper
    await db.prepare(
      'UPDATE races SET participant_id = ? WHERE participant_id = ?'
    ).bind(op.newId, op.oldId).run();

    // Delete the duplicate participant
    await db.prepare(
      'DELETE FROM participants WHERE id = ?'
    ).bind(op.oldId).run();
  }

  console.log(`\nSuccessfully merged ${mergeOperations.length} duplicate records`);
}

// For running standalone with wrangler
// Uncomment and modify if needed for your setup
/*
export default {
  async fetch(request, env) {
    await mergeDuplicates(env.DB);
    return new Response('Migration complete', { status: 200 });
  }
};
*/
