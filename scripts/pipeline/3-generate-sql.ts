import fs from 'fs';
import path from 'path';

interface Race {
  Datums: string;
  Rezultāts: string;
  km: string;
  Vieta: string;
  season: string;
}

interface Participant {
  name: string;
  link: string;
  races: Race[];
  normalized_name: string;
}

/**
 * Escape SQL string by doubling single quotes
 */
export function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Generate idempotent SQL from normalized JSON files
 *
 * Generates:
 * - UPSERT statements for participants (ON CONFLICT DO UPDATE)
 * - Conditional INSERT statements for races (NOT EXISTS check)
 *
 * The generated SQL is safe to run multiple times without creating duplicates.
 */
export function generateSQL(dataDir: string, outputFile: string): void {
  console.log(`\n=== Generating SQL from ${dataDir} ===\n`);

  let sql = '';
  let participantCount = 0;
  let raceCount = 0;

  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const seasons = fs.readdirSync(dataDir).filter(f =>
    fs.statSync(path.join(dataDir, f)).isDirectory()
  );

  for (const season of seasons) {
    const seasonPath = path.join(dataDir, season);
    const distances = fs.readdirSync(seasonPath).filter(f =>
      fs.statSync(path.join(seasonPath, f)).isDirectory()
    );

    for (const distance of distances) {
      const distancePath = path.join(seasonPath, distance);
      const files = fs.readdirSync(distancePath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(distancePath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const participants: Participant[] = JSON.parse(content);

        // Determine gender from filename (check 'women' first since 'men' is substring of 'women')
        const gender = file.includes('women') ? 'S' : (file.includes('men') ? 'V' : 'U');

        for (const p of participants) {
          if (!p.normalized_name) {
            console.warn(`Warning: Participant "${p.name}" missing normalized_name field`);
            continue;
          }

          // Generate UPSERT for participant
          const escapedName = escapeSQLString(p.name);
          const escapedNormalizedName = escapeSQLString(p.normalized_name);

          sql += `INSERT INTO participants (name, distance, gender, normalized_name)\n`;
          sql += `VALUES ('${escapedName}', '${distance}', '${gender}', '${escapedNormalizedName}')\n`;
          sql += `ON CONFLICT(normalized_name, distance, gender)\n`;
          sql += `DO UPDATE SET name = excluded.name;\n\n`;
          participantCount++;

          // Generate conditional INSERT for each race
          for (const race of p.races) {
            if (!race.season) {
              console.warn(`Warning: Race for "${p.name}" on ${race.Datums} missing season field`);
              continue;
            }

            const escapedDate = escapeSQLString(race.Datums);
            const escapedResult = escapeSQLString(race.Rezultāts);
            const escapedKm = escapeSQLString(race.km);
            const escapedLocation = escapeSQLString(race.Vieta);
            const escapedSeason = escapeSQLString(race.season);

            sql += `INSERT INTO races (participant_id, date, result, km, location, season)\n`;
            sql += `SELECT p.id, '${escapedDate}', '${escapedResult}', '${escapedKm}', '${escapedLocation}', '${escapedSeason}'\n`;
            sql += `FROM participants p\n`;
            sql += `WHERE p.normalized_name = '${escapedNormalizedName}'\n`;
            sql += `  AND p.distance = '${distance}'\n`;
            sql += `  AND p.gender = '${gender}'\n`;
            sql += `AND NOT EXISTS (\n`;
            sql += `  SELECT 1 FROM races r\n`;
            sql += `  WHERE r.participant_id = p.id\n`;
            sql += `    AND r.date = '${escapedDate}'\n`;
            sql += `    AND r.location = '${escapedLocation}'\n`;
            sql += `);\n\n`;
            raceCount++;
          }
        }
      }
    }
  }

  fs.writeFileSync(outputFile, sql);
  console.log(`✓ Generated ${participantCount} participant UPSERT statements`);
  console.log(`✓ Generated ${raceCount} race INSERT statements`);
  console.log(`✓ Wrote SQL to ${outputFile}\n`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2] || path.resolve('data');
  const outputFile = process.argv[3] || path.resolve('import_data.sql');
  generateSQL(dataDir, outputFile);
}
