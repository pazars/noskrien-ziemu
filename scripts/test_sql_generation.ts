import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');

function main() {
    console.log(`=== Testing SQL Generation with Combined Data ===\n`);
    console.log(`Scanning ${DATA_DIR}...\n`);

    const stats = {
        seasons: 0,
        tautasParticipants: 0,
        sportaParticipants: 0,
        totalRaces: 0,
    };

    if (fs.existsSync(DATA_DIR)) {
        const seasons = fs.readdirSync(DATA_DIR).filter(f =>
            fs.statSync(path.join(DATA_DIR, f)).isDirectory()
        );

        stats.seasons = seasons.length;

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
                    const participants = JSON.parse(content);

                    const gender = file.includes('men') ? 'V' : (file.includes('women') ? 'S' : 'U');

                    console.log(`${season} / ${distance} / ${gender}: ${participants.length} participants`);

                    if (distance === 'Tautas') {
                        stats.tautasParticipants += participants.length;
                    } else if (distance === 'Sporta') {
                        stats.sportaParticipants += participants.length;
                    }

                    for (const p of participants) {
                        stats.totalRaces += p.races.length;
                    }
                }
            }
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Seasons: ${stats.seasons}`);
    console.log(`Tautas participants: ${stats.tautasParticipants}`);
    console.log(`Sporta participants: ${stats.sportaParticipants}`);
    console.log(`Total participants: ${stats.tautasParticipants + stats.sportaParticipants}`);
    console.log(`Total races: ${stats.totalRaces}`);
}

main();
