
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const OUTPUT_FILE = path.resolve('import_data.sql');

// Helper to escape SQL strings
const escape = (str: string) => str.replace(/'/g, "''");

function main() {
    console.log(`Scanning ${DATA_DIR}...`);

    let sql = "";
    // sql += "DELETE FROM races;\n";
    // sql += "DELETE FROM participants;\n";

    if (fs.existsSync(DATA_DIR)) {
        const seasons = fs.readdirSync(DATA_DIR);

        let participantIdCounter = 1;

        for (const season of seasons) {
            const seasonPath = path.join(DATA_DIR, season);
            if (!fs.statSync(seasonPath).isDirectory()) continue;

            const distances = fs.readdirSync(seasonPath);
            for (const distance of distances) {
                const distancePath = path.join(seasonPath, distance);
                if (!fs.statSync(distancePath).isDirectory()) continue;

                const files = fs.readdirSync(distancePath);
                for (const file of files) {
                    if (!file.endsWith('.json')) continue;

                    // Determine gender from filename: results_men.json -> V, results_women.json -> S
                    let gender = 'U';
                    if (file.includes('men')) gender = 'V';
                    if (file.includes('women')) gender = 'S';

                    const filePath = path.join(distancePath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const participants = JSON.parse(content);

                    console.log(`Processing ${season} ${distance} ${gender}: ${participants.length} participants`);

                    for (const p of participants) {
                        const pid = participantIdCounter++;
                        const name = escape(p.name);
                        const link = escape(p.link);

                        sql += `INSERT INTO participants (id, name, link, season, distance, gender) VALUES (${pid}, '${name}', '${link}', '${season}', '${distance}', '${gender}');\n`;

                        for (const r of p.races) {
                            const date = escape(r.Datums);
                            const result = escape(r.Rezultāts);
                            const km = escape(r.km);
                            const location = escape(r.Vieta);

                            sql += `INSERT INTO races (participant_id, date, result, km, location) VALUES (${pid}, '${date}', '${result}', '${km}', '${location}');\n`;
                        }
                    }
                }
            }
        }
    }

    fs.writeFileSync(OUTPUT_FILE, sql);
    console.log(`Generated ${OUTPUT_FILE}`);
}

main();
