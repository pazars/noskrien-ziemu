import fs from 'fs';
import path from 'path';
import { normalizeLatvian, countLatvianChars, hasNaturalCasing, deriveSeasonFromDate } from '../../src/utils/latvian.js';

interface Race {
  Datums: string;
  Rezultāts: string;
  km: string;
  Vieta: string;
  season?: string;
}

interface Participant {
  name: string;
  link: string;
  races: Race[];
  normalized_name?: string;
}

interface ParticipantRecord {
  name: string;
  link: string;
  races: Race[];
  season: string;
  distance: string;
  gender: string;
}

/**
 * Select canonical name from list of variants
 * Priority: more Latvian chars > natural casing > alphabetical
 */
export function selectCanonicalName(names: string[]): string {
  return names.sort((a, b) => {
    // 1. More Latvian chars wins
    const diff = countLatvianChars(b) - countLatvianChars(a);
    if (diff !== 0) return diff;

    // 2. Natural casing wins over UPPERCASE
    const aNatural = hasNaturalCasing(a);
    const bNatural = hasNaturalCasing(b);
    if (aNatural !== bNatural) return aNatural ? -1 : 1;

    // 3. Alphabetical tie-breaker
    return a.localeCompare(b);
  })[0];
}

/**
 * Normalize data in-place
 * - Merge duplicates with different Latvian spellings
 * - Add normalized_name field
 * - Add season to races
 */
export function normalizeData(dataDir: string): {
  uniqueParticipants: number;
  mergedDuplicates: number;
} {
  console.log(`\n=== Normalizing data in ${dataDir} ===\n`);

  const registry = new Map<string, ParticipantRecord[]>();
  let totalParticipants = 0;

  // Step 1: Load all participants
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

        const gender = file.includes('women') ? 'S' : (file.includes('men') ? 'V' : 'U');

        for (const p of participants) {
          totalParticipants++;

          const normalized = normalizeLatvian(p.name).toLowerCase();
          const key = `${normalized}|${distance}|${gender}`;

          if (!registry.has(key)) {
            registry.set(key, []);
          }

          registry.get(key)!.push({
            name: p.name,
            link: p.link,
            races: p.races,
            season,
            distance,
            gender
          });
        }
      }
    }
  }

  console.log(`Loaded ${totalParticipants} participants across all seasons`);

  // Step 1.5: Fix cross-gender duplicates
  // If a name exists in BOTH men's and women's files for the same distance,
  // merge the men's records into women's (women's file is authoritative) and remove from men's
  let crossGenderMerges = 0;
  const keysToRemove: string[] = [];

  for (const [key, group] of registry.entries()) {
    const [normalized, distance, gender] = key.split('|');

    // Only process men's entries - check if same name exists in women's file
    if (gender === 'V') {
      const womenKey = `${normalized}|${distance}|S`;
      if (registry.has(womenKey)) {
        // This is a cross-gender duplicate - merge men's races into women's
        const womenGroup = registry.get(womenKey)!;

        // Move all men's races to women's group
        for (const menRecord of group) {
          womenGroup.push({
            ...menRecord,
            gender: 'S' // Change gender to S so it writes to women's file
          });
        }

        // Mark men's key for removal
        keysToRemove.push(key);
        crossGenderMerges += group.length;
      }
    }
  }

  // Remove the cross-gender duplicate keys
  for (const key of keysToRemove) {
    registry.delete(key);
  }

  if (crossGenderMerges > 0) {
    console.log(`Fixed ${crossGenderMerges} cross-gender duplicates (moved to women's files)`);
  }

  // Step 2: Merge duplicates and write back
  let mergedCount = 0;
  const processedFiles = new Map<string, Participant[]>();

  for (const [key, group] of registry.entries()) {
    if (group.length > 1) {
      const uniqueNames = new Set(group.map(p => p.name));
      if (uniqueNames.size > 1) {
        mergedCount += group.length - 1;
      }
    }

    // Select canonical name
    const canonicalName = selectCanonicalName(group.map(p => p.name));
    const normalized = normalizeLatvian(canonicalName).toLowerCase();

    // Merge all races
    const allRaces: Race[] = [];
    for (const participant of group) {
      for (const race of participant.races) {
        // Add season to race
        allRaces.push({
          ...race,
          season: deriveSeasonFromDate(race.Datums)
        });
      }
    }

    // Group races by file location (season/distance/gender)
    const racesByFile = new Map<string, Race[]>();
    for (const participant of group) {
      const season = participant.season;
      const distance = participant.distance;
      const gender = participant.gender;
      const fileName = gender === 'V' ? 'results_men.json' : 'results_women.json';
      const filePath = path.join(dataDir, season, distance, fileName);

      if (!racesByFile.has(filePath)) {
        racesByFile.set(filePath, []);
      }

      // Add this participant's races (with season field added)
      for (const race of participant.races) {
        racesByFile.get(filePath)!.push({
          ...race,
          season: deriveSeasonFromDate(race.Datums)
        });
      }
    }

    // Create participant entry for each file with only relevant races
    const firstOccurrence = group[0];
    for (const [filePath, races] of racesByFile.entries()) {
      if (!processedFiles.has(filePath)) {
        processedFiles.set(filePath, []);
      }

      const participantForFile: Participant = {
        name: canonicalName,
        link: firstOccurrence.link,
        races: races,
        normalized_name: normalized
      };

      processedFiles.get(filePath)!.push(participantForFile);
    }
  }

  // Step 3: Write back to files
  console.log(`\nWriting normalized data to ${processedFiles.size} files...`);
  for (const [filePath, participants] of processedFiles.entries()) {
    const sampleParticipant = participants[0];
    const hasNormalizedName = sampleParticipant && 'normalized_name' in sampleParticipant;
    console.log(`  ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}: ${participants.length} participants (normalized_name: ${hasNormalizedName})`);
    fs.writeFileSync(filePath, JSON.stringify(participants, null, 2));
  }

  const uniqueCount = registry.size;
  console.log(`\n✓ Merged ${mergedCount} duplicates`);
  console.log(`✓ Final count: ${uniqueCount} unique participants\n`);

  return {
    uniqueParticipants: uniqueCount,
    mergedDuplicates: mergedCount
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2] || path.resolve('data');
  normalizeData(dataDir);
}
