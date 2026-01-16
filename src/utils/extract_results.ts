export interface RaceResult {
    Rezultāts: string;
    km: string;
    Datums: string;
    Vieta: string;
}

export interface Participant {
    name: string;
    link: string;
    races: RaceResult[];
}

const MONTH_MAP: Record<string, number> = {
    'janvāris': 1, 'februāris': 2, 'marts': 3, 'aprīlis': 4, 'maijs': 5, 'jūnijs': 6,
    'jūlijs': 7, 'augusts': 8, 'septembris': 9, 'oktobris': 10, 'novembris': 11, 'decembris': 12
};

export function parseDate(dateStr: string, startYear: number, endYear: number): string {
    // Format: "17.decembris" or "21.janvāris"
    const parts = dateStr.trim().split('.');
    if (parts.length < 2) return dateStr;

    const day = parts[0].trim();
    const monthName = parts[1].trim().toLowerCase();
    const month = MONTH_MAP[monthName];

    if (!month) return dateStr;

    let year = endYear;
    // If month is late in the year (July-Dec), it belongs to the start of the season
    if (month >= 7) {
        year = startYear;
    }

    // Format YYYY-MM-DD
    const pad = (n: any) => n.toString().padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
}

export function extractLinks(html: string, baseUrl: string, limit: number = Infinity): string[] {
    const links: string[] = [];
    // Note: This regex assumes the hrefs are relative starting with ../dal/
    // If we want to capture ALL links that look like participants we might need a broader regex,
    // but based on earlier investigation ../dal/ matches all participants.
    const regex = /<a\s+href="(\.\.\/dal\/[^"]+)"/gi;
    let match;
    while ((match = regex.exec(html)) !== null && links.length < limit) {
        let href = match[1];
        if (href.startsWith('../')) {
            // href is ../dal/FILE.HTM
            // We want to append dal/FILE.HTM to the base.
            // But baseUrl usually ends in something like .../kopnz_1/
            // The relative link ../ means go up one level.
            // If baseUrl is https://rez.magnets.lv/NZ_17-18/kopv/kopnz_1/
            // Then ../dal/ -> https://rez.magnets.lv/NZ_17-18/kopv/dal/

            // To be robust: resolve relative URL against baseUrl
            // We can use the URL API if we are in node environment.
            try {
                // Determine absolute URL
                // We need to handle the fact that baseUrl might not end in /? 
                // Assumed passed baseUrl is the page URL or directory URL?
                // Let's assume baseUrl is the PAGE URL (e.g. .../VT.HTM) for resolution context.
                // Or let's assume it's the directory.

                // Let's stick to simple string manipulation as before but using the passed base.
                // The previous logic was: replace ../ with the hardcoded base '.../kopv/'
                // So if baseUrl passed in is '.../kopv/', then we just append href.substring(3).

                // Let's change the contract: baseUrl is the 'kopv' directory URL.

                href = href.substring(3); // remove ../
                links.push(baseUrl + href);
            } catch (e) {
                // fallback
                links.push(href);
            }
        } else {
            links.push(href);
        }
    }
    return links;
}

export function extractRaces(html: string, startYear: number, endYear: number): RaceResult[] {
    const participantResults: RaceResult[] = [];
    const tableMatch = html.match(/<table\s+(?:[^>]*\s+)?border=["']?1["']?[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return participantResults;

    const tableContent = tableMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch;
    let rowIndex = 0;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowHtml = rowMatch[1];
        if (rowIndex === 0) { rowIndex++; continue; }

        const cells: string[] = [];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            let text = cellMatch[1].replace(/&nbsp;?/g, ' ').replace(/<[^>]+>/g, '').trim();
            cells.push(text);
        }

        if (cells.length >= 10 && !isNaN(parseInt(cells[0]))) {
            const rawDate = cells[8];
            const formattedDate = parseDate(rawDate, startYear, endYear);

            participantResults.push({
                Rezultāts: cells[1],
                km: cells[5],
                Datums: formattedDate,
                Vieta: cells[9]
            });
        }
        rowIndex++;
    }
    return participantResults;
}

export function extractName(html: string): string {
    const nameMatch = html.match(/<title>(.*?)<\/title>/i);
    return nameMatch ? nameMatch[1] : 'Unknown';
}
