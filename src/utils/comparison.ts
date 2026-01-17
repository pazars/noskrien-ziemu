
export interface Race {
    date: string;
    result: string;
    km: string;
    location: string;
    season: string;
    category?: string;
}

export interface HistoryResponse {
    name: string;
    races: Race[];
}

export const parseTime = (timeStr: string) => {
    if (!timeStr) return null;
    const cleanStr = timeStr.trim();
    if (cleanStr === '' || cleanStr === '0' || cleanStr === 'x' || cleanStr === '-') return null;

    const parts = cleanStr.split(':');
    let seconds = 0;

    if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else {
        return null;
    }

    return isNaN(seconds) ? null : seconds;
};

export const calculatePace = (timeSeconds: number, km: number) => {
    if (!km || km === 0) return null;
    return timeSeconds / km; // seconds per km
};

// Derive season from race date (e.g., "2023-11-26" -> "2023-2024")
// Noskrien Ziemu season runs from November to March
export const deriveSeasonFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    // If race is Nov or Dec, season is YYYY-(YYYY+1)
    // If race is Jan-Mar, season is (YYYY-1)-YYYY
    if (month >= 11) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
};

export function compareRaces(hist1: HistoryResponse, hist2: HistoryResponse, category: string) {
    const commonRaces = [];

    const p2RacesMap = new Map();
    if (hist2.races) {
        hist2.races.forEach(r => {
            const cat = r.category ? r.category.trim() : 'Tautas';
            const loc = r.location ? r.location.trim() : '';
            const key = `${r.date}|${loc}|${cat}`;
            p2RacesMap.set(key, r);
        });
    }

    if (hist1.races) {
        for (const r1 of hist1.races) {
            const cat1 = r1.category ? r1.category.trim() : 'Tautas';
            if (cat1 !== category) continue;

            // Build composite key to match races by date, location, and category
            const loc1 = r1.location ? r1.location.trim() : '';
            const key = `${r1.date}|${loc1}|${cat1}`;
            const r2 = p2RacesMap.get(key);

            if (r2) {
                // Already verified category matches through the key
                const loc2 = r2.location ? r2.location.trim() : '';

                if (loc1 === loc2) {
                    const time1 = parseTime(r1.result);
                    const time2 = parseTime(r2.result);
                    // Parse distances (handle comma decimals)
                    const dist1 = parseFloat(r1.km.replace(',', '.'));
                    const dist2 = parseFloat(r2.km.replace(',', '.'));

                    // Ensure distances are valid and approximately equal (within 0.5km)
                    // This handles cases where one runs 10km and another 20km in the same event
                    if (dist1 > 0 && dist2 > 0 && Math.abs(dist1 - dist2) < 0.5) {
                        if (time1 !== null && time2 !== null) {
                            const pace1 = calculatePace(time1, dist1);
                            const pace2 = calculatePace(time2, dist2);

                            if (pace1 !== null && pace2 !== null) {
                                const diff = pace1 - pace2;

                                commonRaces.push({
                                    date: r1.date,
                                    race: r1.location,
                                    season: deriveSeasonFromDate(r1.date),
                                    pace1,
                                    pace2,
                                    diff,
                                    p1Time: r1.result,
                                    p2Time: r2.result,
                                    distance: r1.km
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    commonRaces.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return commonRaces;
}
