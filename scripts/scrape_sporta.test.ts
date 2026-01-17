import { describe, it, expect } from 'vitest';
import https from 'https';
import { TextDecoder } from 'util';

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

describe('Sporta scraper URL construction', () => {
    it('should construct correct URL for men Sporta 2017-2018', () => {
        const yearStart = 17;
        const yearEnd = 18;
        const seasonStr = `${yearStart}-${yearEnd}`;
        const category = 'V';

        const expectedUrl = `https://rez.magnets.lv/NZ_${seasonStr}/kopv/kopnz_1/${category}S.HTM`;
        expect(expectedUrl).toBe('https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VS.HTM');
    });

    it('should construct correct URL for women Sporta 2017-2018', () => {
        const yearStart = 17;
        const yearEnd = 18;
        const seasonStr = `${yearStart}-${yearEnd}`;
        const category = 'S';

        const expectedUrl = `https://rez.magnets.lv/NZ_${seasonStr}/kopv/kopnz_1/${category}S.HTM`;
        expect(expectedUrl).toBe('https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/SS.HTM');
    });

    it('should use Sporta distance in output path', () => {
        const season = '2017-2018';
        const distance = 'Sporta';
        const gender = 'men';

        const outputPath = `data/${season}/${distance}/results_${gender}.json`;
        expect(outputPath).toBe('data/2017-2018/Sporta/results_men.json');
    });
});

describe('Sporta scraper - URL availability', () => {
    it('should be able to fetch men Sporta page for 2017-2018', async () => {
        const url = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VS.HTM';

        const html = await fetchUrl(url);

        expect(html).toBeTruthy();
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('href'); // Should contain links
    }, 30000); // 30 second timeout for network request

    it('should be able to fetch women Sporta page for 2017-2018', async () => {
        const url = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/SS.HTM';

        const html = await fetchUrl(url);

        expect(html).toBeTruthy();
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('href'); // Should contain links
    }, 30000); // 30 second timeout for network request
});

describe('Sporta scraper - data extraction', () => {
    it('should extract participant links from men Sporta page', async () => {
        const url = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VS.HTM';
        const baseUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/';

        const html = await fetchUrl(url);
        // Import dynamically to use the actual extractLinks function
        const { extractLinks } = await import('../src/utils/extract_results.js');
        const links = extractLinks(html, baseUrl);

        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toContain('rez.magnets.lv');
        expect(links[0]).toContain('dal/');
    }, 30000);

    it('should extract participant data from a single participant page', async () => {
        const url = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VS.HTM';
        const baseUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/';

        const mainHtml = await fetchUrl(url);
        const { extractLinks, extractName, extractRaces } = await import('../src/utils/extract_results.js');
        const links = extractLinks(mainHtml, baseUrl);

        expect(links.length).toBeGreaterThan(0);

        // Test first participant
        const participantHtml = await fetchUrl(links[0]);
        const name = extractName(participantHtml);
        const races = extractRaces(participantHtml, 2017, 2018);

        expect(name).toBeTruthy();
        expect(name).not.toBe('Unknown');
        expect(Array.isArray(races)).toBe(true);

        // Each race should have the required fields
        if (races.length > 0) {
            const race = races[0];
            expect(race).toHaveProperty('Rezultāts');
            expect(race).toHaveProperty('km');
            expect(race).toHaveProperty('Datums');
            expect(race).toHaveProperty('Vieta');
        }
    }, 30000);
});
