import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');

// Normalize Latvian characters for comparison
function normalizeLatvian(text: string): string {
    return text
        .replace(/ā/gi, 'a')
        .replace(/č/gi, 'c')
        .replace(/ē/gi, 'e')
        .replace(/ģ/gi, 'g')
        .replace(/ī/gi, 'i')
        .replace(/ķ/gi, 'k')
        .replace(/ļ/gi, 'l')
        .replace(/ņ/gi, 'n')
        .replace(/š/gi, 's')
        .replace(/ū/gi, 'u')
        .replace(/ž/gi, 'z');
}

interface ParticipantRecord {
    name: string;
    season: string;
    distance: string;
    gender: string;
    link: string;
}

function main() {
    console.log(`=== Checking for Duplicates ===\n`);

    const participants: ParticipantRecord[] = [];

    if (fs.existsSync(DATA_DIR)) {
        const seasons = fs.readdirSync(DATA_DIR).filter(f =>
            fs.statSync(path.join(DATA_DIR, f)).isDirectory()
        );

        for (const season of seasons) {
            const seasonPath = path.join(DATA_DIR, season);
            const distances = fs.readdirSync(seasonPath).filter(f =>
                fs.statSync(path.join(seasonPath, f)).isDirectory()
            );

            for (const distance of distances) {
                const distancePath = path.join(seasonPath, distance);
                const files = fs.readdirSync(distancePath).filter(f => f.endsWith('.json'));

                for (const file of files) {
                    const filePath = path.join(distancePath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    const gender = file.includes('men') ? 'V' : (file.includes('women') ? 'S' : 'U');

                    for (const p of data) {
                        participants.push({
                            name: p.name,
                            season,
                            distance,
                            gender,
                            link: p.link,
                        });
                    }
                }
            }
        }
    }

    console.log(`Total participants loaded: ${participants.length}\n`);

    // Group by normalized name + distance + gender (cross-season)
    const groups = new Map<string, ParticipantRecord[]>();

    for (const p of participants) {
        const normalized = normalizeLatvian(p.name).toLowerCase();
        const key = `${normalized}|${p.distance}|${p.gender}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(p);
    }

    // Find groups with duplicates
    const duplicates = new Map<string, ParticipantRecord[]>();

    for (const [key, group] of groups.entries()) {
        if (group.length > 1) {
            const uniqueNames = new Set(group.map(p => p.name));
            if (uniqueNames.size > 1) {
                duplicates.set(key, group);
            }
        }
    }

    console.log(`Found ${duplicates.size} duplicate groups\n`);

    if (duplicates.size > 0) {
        console.log(`=== Sample Duplicates (first 10) ===\n`);

        let count = 0;
        for (const [key, group] of duplicates.entries()) {
            if (count >= 10) break;
            count++;

            console.log(`Group ${count}:`);
            const uniqueNames = [...new Set(group.map(p => p.name))];
            console.log(`  Names: ${uniqueNames.join(', ')}`);
            console.log(`  Distance: ${group[0].distance}`);
            console.log(`  Gender: ${group[0].gender}`);
            console.log(`  Seasons: ${group.map(p => p.season).join(', ')}`);
            console.log('');
        }

        console.log(`\n⚠️  ${duplicates.size} duplicate groups found!`);
        console.log(`These should be merged using the Latvian merge migration.`);
        console.log(`Run: ./migrations/run-latvian-merge.sh\n`);
    } else {
        console.log(`✓ No duplicates found! Data is clean.\n`);
    }
}

main();
