
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

// Simple sleep to be nice to the server
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const rawUrl = process.argv[2];
    const outputFile = process.argv[3] || 'results.json';

    let mainUrl = rawUrl;
    if (!mainUrl) {
        console.log("No URL provided, defaulting to men's results.");
        mainUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VT.HTM';
    }

    // Extract years from URL: NZ_17-18
    let startYear = 2017;
    let endYear = 2018;

    const yearMatch = mainUrl.match(/NZ_(\d{2})-(\d{2})/);
    if (yearMatch) {
        startYear = 2000 + parseInt(yearMatch[1]);
        endYear = 2000 + parseInt(yearMatch[2]);
    }
    console.log(`Season years: ${startYear}-${endYear}`);

    console.log(`Fetching main page: ${mainUrl}`);
    const mainHtml = await fetchUrl(mainUrl);

    // Extract all links (limit Infinity)
    // baseUrl for extractLinks should be the 'kopv' directory or similar base for relative resolution.
    // In extractLinks logic, we append href (minus ../) to baseUrl.
    // If mainUrl is https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VT.HTM
    // And links are ../dal/FILE.HTM
    // Then we want https://rez.magnets.lv/NZ_17-18/kopv/dal/FILE.HTM
    // So baseUrl should be https://rez.magnets.lv/NZ_17-18/kopv/

    // Calculate correct base url for extractLinks
    // It seems the structure is always .../kopv/kopnz_1/page.htm
    // So we want to go up one level from the directory of mainUrl?
    // mainUrl dir: .../kopv/kopnz_1/
    // Up one level: .../kopv/

    // Let's derive it safely.
    // remove last component of directory?
    const mainDir = mainUrl.substring(0, mainUrl.lastIndexOf('/') + 1); // .../kopnz_1/
    // Remove trailing slash to find parent
    const parentDir = mainDir.substring(0, mainDir.length - 1);
    const extractBaseUrl = parentDir.substring(0, parentDir.lastIndexOf('/') + 1); // .../kopv/

    console.log(`Extract Base URL: ${extractBaseUrl}`);
    const links = extractLinks(mainHtml, extractBaseUrl);
    console.log(`Found ${links.length} participants.`);

    const results: Participant[] = [];

    // Process sequentially or with limited concurrency to avoid being blocked
    // Sequential for safety
    let count = 0;
    for (const link of links) {
        count++;
        // process.stdout.write(`Processing ${count}/${links.length}: ${link}\r`);

        try {
            const html = await fetchUrl(link);
            const name = extractName(html);
            const races = extractRaces(html, startYear, endYear);

            results.push({
                name,
                link,
                races
            });
        } catch (error) {
            console.error(`\nError processing ${link}:`, error);
        }

        // Sleep a tiny bit to limit request rate
        // 10ms is usually fine for this kind of site, or 0 if we want to risk it.
        // Let's do 10ms.
        // await sleep(10);
    }

    console.log(`\nExtracted data for ${results.length} participants.`);

    const outputPath = path.resolve(outputFile);
    // Ensure dir exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Saved results to ${outputPath}`);
}

main().catch(console.error);
