
import https from 'https';
import fs from 'fs';
import path from 'path';
import { TextDecoder } from 'util';
import { extractLinks, extractRaces, extractName, Participant } from '../src/utils/extract_results.js';

function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const data: Buffer[] = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                try {
                    const decoder = new TextDecoder('windows-1257');
                    resolve(decoder.decode(buffer));
                } catch (e) {
                    console.error("Encoding error:", e);
                    resolve(buffer.toString('binary'));
                }
            });
        }).on('error', reject);
    });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeCategory(yearStart: number, category: 'V' | 'S', seasonStr: string) {
    const yearEnd = yearStart + 1;
    const fullSeason = `20${yearStart}-20${yearEnd}`;

    // Construct URLs
    // Example: https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VT.HTM
    const mainUrl = `https://rez.magnets.lv/NZ_${seasonStr}/kopv/kopnz_1/${category}T.HTM`;
    const genderName = category === 'V' ? 'men' : 'women';
    const outputDir = `data/${fullSeason}/Tautas`;
    const outputFile = path.join(outputDir, `results_${genderName}.json`);

    console.log(`\n=== Processing ${fullSeason} ${genderName} (${mainUrl}) ===`);

    try {
        // Calculate Extract Base URL
        // From: https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VT.HTM
        // Parent dir: .../kopnz_1/
        // Extract base: .../kopv/ 
        // Logic: remove last two components? 
        // .../kopnz_1/VT.HTM -> .../kopnz_1/ -> .../kopv/
        const mainDir = mainUrl.substring(0, mainUrl.lastIndexOf('/') + 1);
        const parentDir = mainDir.substring(0, mainDir.length - 1);
        const extractBaseUrl = parentDir.substring(0, parentDir.lastIndexOf('/') + 1);

        console.log(`Fetching main page...`);
        const mainHtml = await fetchUrl(mainUrl);
        const links = extractLinks(mainHtml, extractBaseUrl);
        console.log(`Found ${links.length} participants.`);

        const results: Participant[] = [];
        let count = 0;

        for (const link of links) {
            count++;
            // process.stdout.write(`Processing ${count}/${links.length}\r`);
            try {
                const html = await fetchUrl(link);
                const name = extractName(html);
                const races = extractRaces(html, 2000 + yearStart, 2000 + yearEnd);
                results.push({ name, link, races });
            } catch (error) {
                console.error(`Error processing ${link}:`, error);
            }
            // Sleep slightly
            // await sleep(5); 
        }

        console.log(`Extracted ${results.length} participants.`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`Saved to ${outputFile}`);

    } catch (e) {
        console.error(`Failed to process ${fullSeason} ${genderName}:`, e);
    }
}

async function main() {
    // Years 17-18 to 25-26
    // startYears: 17, 18, 19, 20, 21, 22, 23, 24, 25
    const startYears = [17, 18, 19, 20, 21, 22, 23, 24, 25];

    for (const year of startYears) {
        const nextYear = year + 1;
        const seasonStr = `${year}-${nextYear}`; // e.g., 17-18

        // Men
        await scrapeCategory(year, 'V', seasonStr);
        // Women
        await scrapeCategory(year, 'S', seasonStr);
    }
}

main().catch(console.error);
