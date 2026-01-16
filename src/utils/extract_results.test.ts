import { describe, it, expect } from 'vitest';
import { parseDate, extractLinks, extractRaces } from './extract_results';

describe('Race Results Extraction', () => {

    describe('parseDate', () => {
        it('should correctly parse dates in the first half of the season (late year)', () => {
            const date = '17.decembris';
            const startYear = 2017;
            const endYear = 2018;
            expect(parseDate(date, startYear, endYear)).toBe('2017-12-17');
        });

        it('should correctly parse dates in the second half of the season (early year)', () => {
            const date = '21.janvāris';
            const startYear = 2017;
            const endYear = 2018;
            expect(parseDate(date, startYear, endYear)).toBe('2018-01-21');
        });

        it('should return original string if format is invalid', () => {
            expect(parseDate('invalid', 2017, 2018)).toBe('invalid');
        });

        it('should handle different capitalization and spacing', () => {
            expect(parseDate(' 18.Februāris ', 2017, 2018)).toBe('2018-02-18');
        });
    });

    describe('extractLinks', () => {
        it('should extract links and correct relative paths', () => {
            const html = `
                <a1>1<a href="../dal/file1.htm">Name 1</a></a1>
                2<a href="../dal/file2.htm">Name 2</a>
                <a1>3<a href="../dal/file3.htm">Name 3</a></a1>
                4<a href="../dal/file4.htm">Name 4</a>
            `;
            const baseUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/';
            const links = extractLinks(html, baseUrl);
            expect(links).toHaveLength(4);
            expect(links[0]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/file1.htm');
            expect(links[1]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/file2.htm');
            expect(links[2]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/file3.htm');
            expect(links[3]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/file4.htm');
        });

        it('should extract links even when they are not wrapped in <a1> tags (regression test)', () => {
            const html = `
                10<a href="../dal/user1.htm">User 1</a>
                <div><a href="../dal/user2.htm">User 2</a></div>
                <p>Some text <a href="../dal/user3.htm">User 3</a></p>
            `;
            const baseUrl = 'https://rez.magnets.lv/NZ_17-18/kopv/';
            const links = extractLinks(html, baseUrl);
            expect(links).toHaveLength(3);
            expect(links[0]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/user1.htm');
            expect(links[1]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/user2.htm');
            expect(links[2]).toBe('https://rez.magnets.lv/NZ_17-18/kopv/dal/user3.htm');
        });
    });

    describe('extractRaces', () => {
        it('should extract race results from table', () => {
            const html = `
                <table border="1">
                    <tr><th>Header</th></tr>
                    <tr>
                        <td>1</td>
                        <td>37:16</td>
                        <td>pts</td>
                        <td>gr</td>
                        <td>dist</td>
                        <td>10.05</td>
                        <td>pace</td>
                        <td>grp</td>
                        <td>17.decembris</td>
                        <td>Sēja</td>
                    </tr>
                </table>
            `;
            const results = extractRaces(html, 2017, 2018);
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                Rezultāts: '37:16',
                km: '10.05',
                Datums: '2017-12-17',
                Vieta: 'Sēja'
            });
        });

        it('should verify race times for Jānis Razgalis (mock data)', () => {
            const html = `
                <table border="1">
                    <tr><th>Header</th></tr>
                    <tr>
                        <td>1</td><td>37:16</td><td>pts</td><td>gr</td><td>dist</td><td>10.05</td><td>pace</td><td>grp</td><td>17.decembris</td><td>Sēja</td>
                    </tr>
                    <tr>
                        <td>2</td><td>37:41</td><td>pts</td><td>gr</td><td>dist</td><td>9.40</td><td>pace</td><td>grp</td><td>21.janvāris</td><td>Āraiši</td>
                    </tr>
                    <tr>
                        <td>3</td><td>36:55</td><td>pts</td><td>gr</td><td>dist</td><td>8.70</td><td>pace</td><td>grp</td><td>18.februāris</td><td>Priekuļi</td>
                    </tr>
                    <tr>
                        <td>4</td><td>24:48</td><td>pts</td><td>gr</td><td>dist</td><td>7.00</td><td>pace</td><td>grp</td><td>18.marts</td><td>Rīga</td>
                    </tr>
                </table>
            `;
            const results = extractRaces(html, 2017, 2018);
            expect(results).toHaveLength(4);

            // Verify times specifically as requested
            expect(results[0].Rezultāts).toBe('37:16');
            expect(results[1].Rezultāts).toBe('37:41');
            expect(results[2].Rezultāts).toBe('36:55');
            expect(results[3].Rezultāts).toBe('24:48');

            // Verify dates for sanity
            expect(results[0].Datums).toBe('2017-12-17');
            expect(results[1].Datums).toBe('2018-01-21');
        });

        it('should skip rows that are not data rows', () => {
            const html = `
                <table border="1">
                    <tr><th>Header</th></tr>
                    <tr>
                         <td></td>
                         <td><b>Total</b></td>
                    </tr>
                </table>
            `;
            const results = extractRaces(html, 2017, 2018);
            expect(results).toHaveLength(0);
        });

        it('should handle &nbsp; in cells', () => {
            const html = `
                <table border="1">
                    <tr><th>Header</th></tr>
                    <tr>
                        <td>&nbsp;1</td>
                        <td>&nbsp;37:16</td>
                        <td></td><td></td><td></td>
                        <td>&nbsp;10.05</td>
                        <td></td><td></td>
                        <td>&nbsp;17.decembris</td>
                        <td>&nbsp;Sēja</td>
                    </tr>
                </table>
            `;
            const results = extractRaces(html, 2017, 2018);
            expect(results[0].Vieta).toBe('Sēja');
        });
    });
});
