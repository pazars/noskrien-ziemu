
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

async function scrapeTestSeason() {
    // Test with 2017-2018 men only
    const yearStart = 17;
    const yearEnd = 18;
    const fullSeason = `20${yearStart}-20${yearEnd}`;
    const mainUrl = `https://rez.magnets.lv/NZ_${yearStart}-${yearEnd}/kopv/kopnz_1/VS.HTM`;
    const genderName = 'men';
    const outputDir = `data/${fullSeason}/Sporta`;
    const outputFile = path.join(outputDir, `results_${genderName}.json`);

    console.log(`=== Test Scraping ${fullSeason} ${genderName} Sporta ===`);
    console.log(`URL: ${mainUrl}`);

    const mainDir = mainUrl.substring(0, mainUrl.lastIndexOf('/') + 1);
    const parentDir = mainDir.substring(0, mainDir.length - 1);
    const extractBaseUrl = parentDir.substring(0, parentDir.lastIndexOf('/') + 1);

    console.log(`Fetching main page...`);
    const mainHtml = await fetchUrl(mainUrl);
    const links = extractLinks(mainHtml, extractBaseUrl);
    console.log(`Found ${links.length} participants.`);

    const results: Participant[] = [];
    let count = 0;

    // Only process first 5 participants for testing
    const testLinks = links.slice(0, 5);

    for (const link of testLinks) {
        count++;
        console.log(`Processing ${count}/${testLinks.length}: ${link}`);
        try {
            const html = await fetchUrl(link);
            const name = extractName(html);
            const races = extractRaces(html, 2000 + yearStart, 2000 + yearEnd);
            results.push({ name, link, races });
            console.log(`  Name: ${name}, Races: ${races.length}`);
        } catch (error) {
            console.error(`Error processing ${link}:`, error);
        }
    }

    console.log(`\nExtracted ${results.length} participants.`);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Saved to ${outputFile}`);

    // Display sample data
    console.log(`\n=== Sample Data ===`);
    console.log(JSON.stringify(results[0], null, 2));
}

scrapeTestSeason().catch(console.error);
