
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

export function compareRaces(hist1: HistoryResponse, hist2: HistoryResponse, category: string) {
    const commonRaces = [];

    const p2RacesMap = new Map();
    if (hist2.races) {
        hist2.races.forEach(r => p2RacesMap.set(r.date, r));
    }

    if (hist1.races) {
        for (const r1 of hist1.races) {
            const cat1 = r1.category ? r1.category.trim() : 'Tautas';
            if (cat1 !== category) continue;

            const r2 = p2RacesMap.get(r1.date);
            if (r2) {
                const cat2 = r2.category ? r2.category.trim() : 'Tautas';
                if (cat2 !== category) continue;

                // Normalize locations
                const loc1 = r1.location ? r1.location.trim() : '';
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
                                    season: r1.season,
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
