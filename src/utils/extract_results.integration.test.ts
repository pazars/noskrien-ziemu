
import { describe, it, expect } from 'vitest';
import { extractLinks, extractRaces } from './extract_results';
import https from 'https';
import { TextDecoder } from 'util';

// Helper to fetch (duplicated from script for test isolation)
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
                    resolve(buffer.toString('binary'));
                }
            });
        }).on('error', reject);
    });
}

describe('Race Results Integration (Live)', () => {
    // Increase timeout for network request
    it('should find exactly 311 participants in the specific VT.HTM page', async () => {
        const url = 'https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/VT.HTM';
        const html = await fetchUrl(url);
        // Base is parent of kopnz_1, which is kopv/
        const baseUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/';
        const links = extractLinks(html, baseUrl);
        expect(links).toHaveLength(311);
    }, 20000);

    it('should verify race results for the top 3 participants', async () => {
        const startYear = 2017;
        const endYear = 2018;

        // 1. Jānis Razgalis
        const razgalisUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/dal/JR60250298.HTM';
        const razgalisHtml = await fetchUrl(razgalisUrl);
        const razgalisResults = extractRaces(razgalisHtml, startYear, endYear);

        expect(razgalisResults).toHaveLength(4);
        expect(razgalisResults[0]).toEqual({ Rezultāts: '37:16', km: '10.05', Datums: '2017-12-17', Vieta: 'Sēja' });
        expect(razgalisResults[1]).toEqual({ Rezultāts: '37:41', km: '9.40', Datums: '2018-01-21', Vieta: 'Āraiši' });
        expect(razgalisResults[2]).toEqual({ Rezultāts: '36:55', km: '8.70', Datums: '2018-02-18', Vieta: 'Priekuļi' });
        expect(razgalisResults[3]).toEqual({ Rezultāts: '24:48', km: '7.00', Datums: '2018-03-18', Vieta: 'Rīga' });

        // 2. Kristaps Magone
        const magoneUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/dal/KM31252378.HTM';
        const magoneHtml = await fetchUrl(magoneUrl);
        const magoneResults = extractRaces(magoneHtml, startYear, endYear);

        expect(magoneResults).toHaveLength(4);
        expect(magoneResults[0]).toEqual({ Rezultāts: '57:43', km: '10.05', Datums: '2017-12-17', Vieta: 'Sēja' });
        expect(magoneResults[1]).toEqual({ Rezultāts: '38:00', km: '9.40', Datums: '2018-01-21', Vieta: 'Āraiši' });
        expect(magoneResults[2]).toEqual({ Rezultāts: '38:32', km: '8.70', Datums: '2018-02-18', Vieta: 'Priekuļi' });
        expect(magoneResults[3]).toEqual({ Rezultāts: '25:37', km: '7.00', Datums: '2018-03-18', Vieta: 'Rīga' });

        // 3. Krists Siņicins
        const sinicinsUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/dal/KS61256278.HTM';
        const sinicinsHtml = await fetchUrl(sinicinsUrl);
        const sinicinsResults = extractRaces(sinicinsHtml, startYear, endYear);

        expect(sinicinsResults).toHaveLength(3);
        expect(sinicinsResults[0]).toEqual({ Rezultāts: '37:55', km: '10.05', Datums: '2017-12-17', Vieta: 'Sēja' });
        expect(sinicinsResults[1]).toEqual({ Rezultāts: '37:55', km: '9.40', Datums: '2018-01-21', Vieta: 'Āraiši' });
        expect(sinicinsResults[2]).toEqual({ Rezultāts: '39:34', km: '8.70', Datums: '2018-02-18', Vieta: 'Priekuļi' });
    }, 30000);
});
