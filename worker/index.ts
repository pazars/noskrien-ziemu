
export interface Env {
    DB: D1Database;
}

// Helper function to normalize Latvian characters for search
function normalizeLatvian(text: string): string {
    return text
        .replace(/ā/gi, 'a')
        .replace(/č/gi, 'c')
        .replace(/ē/gi, 'e')
        .replace(/ģ/gi, 'g')
        .replace(/ī/gi, 'i')
        .replace(/ķ/gi, 'k')
        .replace(/ļ/gi, 'l')
        .replace(/ņ/gi, 'n')
        .replace(/š/gi, 's')
        .replace(/ū/gi, 'u')
        .replace(/ž/gi, 'z');
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // CORS headers
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers });
        }

        // Simple router
        if (url.pathname === "/api/results") {
            // Query parameters
            const name = url.searchParams.get("name");
            const distance = url.searchParams.get("distance");

            if (!name || name.length < 2) {
                return Response.json([], { headers });
            }

            // Return DISTINCT names matching query
            // Group by name/gender to avoid duplicates
            // We select one ID just to have a key, but frontend should rely on name
            // Search both original and normalized (Latvian-insensitive) versions
            const normalizedQuery = normalizeLatvian(name);

            // Build query with optional distance filter
            let query = `
                SELECT MIN(id) as id, name, gender
                FROM participants
                WHERE (
                    name LIKE ? COLLATE NOCASE
                    OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                            LOWER(name),
                            'ā', 'a'), 'č', 'c'), 'ē', 'e'), 'ģ', 'g'), 'ī', 'i'),
                            'ķ', 'k'), 'ļ', 'l'), 'ņ', 'n'), 'š', 's'), 'ū', 'u'), 'ž', 'z'),
                        'Ā', 'A'), 'Č', 'C'), 'Ē', 'E'), 'Ģ', 'G'), 'Ī', 'I'),
                        'Ķ', 'K'), 'Ļ', 'L'), 'Ņ', 'N'), 'Š', 'S'), 'Ū', 'U'), 'Ž', 'Z')
                    LIKE ? COLLATE NOCASE
                )
            `;

            const bindings: string[] = [`%${name}%`, `%${normalizedQuery}%`];

            if (distance) {
                query += ` AND distance = ?`;
                bindings.push(distance);
            }

            query += `
                GROUP BY name, gender
                LIMIT 10
            `;

            try {
                const { results } = await env.DB.prepare(query)
                    .bind(...bindings)
                    .all();
                return Response.json(results, { headers });
            } catch (e) {
                return Response.json({ error: (e as Error).message }, { status: 500, headers });
            }
        }

        // Get full history by NAME (not ID)
        // /api/history?name=Janis%20Razgalis
        if (url.pathname === "/api/history") {
            const name = url.searchParams.get("name");
            if (!name) {
                return Response.json({ error: "Name required" }, { status: 400, headers });
            }

            try {
                // Get all races for this name, joined with participant info to get season
                const query = `
                    SELECT 
                        r.date, r.result, r.km, r.location, 
                        p.season, p.distance as category, p.gender
                    FROM races r
                    JOIN participants p ON r.participant_id = p.id
                    WHERE p.name = ?
                    ORDER BY r.date ASC
                `;
                const { results } = await env.DB.prepare(query).bind(name).all();

                return Response.json({ name, races: results }, { headers });
            } catch (e) {
                return Response.json({ error: (e as Error).message }, { status: 500, headers });
            }
        }

        // New endpoint: Get detailed participant info + races
        // /api/participant/123
        const participantMatch = url.pathname.match(/^\/api\/participant\/(\d+)$/);
        if (participantMatch) {
            const id = parseInt(participantMatch[1]);
            try {
                // Get participant
                const participant = await env.DB.prepare("SELECT * FROM participants WHERE id = ?").bind(id).first();
                if (!participant) {
                    return Response.json({ error: "Participant not found" }, { status: 404, headers });
                }

                // Get races
                const { results: races } = await env.DB.prepare("SELECT * FROM races WHERE participant_id = ? ORDER BY date DESC").bind(id).all();

                return Response.json({ ...participant, races }, { headers });
            } catch (e) {
                return Response.json({ error: (e as Error).message }, { status: 500, headers });
            }
        }

        // Migration endpoint: Merge Latvian duplicate participants
        // POST /api/migrate/latvian-duplicates?preview=true (dry run)
        // POST /api/migrate/latvian-duplicates (actual merge)
        if (url.pathname === "/api/migrate/latvian-duplicates" && request.method === "POST") {
            const isPreview = url.searchParams.get("preview") === "true";

            try {
                // Step 1: Find all participants and normalize their names
                const { results: allParticipants } = await env.DB.prepare(`
                    SELECT id, name, season, distance, gender
                    FROM participants
                    ORDER BY id
                `).all();

                // Step 2: Group by normalized name + distance + gender (across all seasons)
                const groups = new Map<string, Array<any>>();

                for (const participant of allParticipants) {
                    const normalized = normalizeLatvian(participant.name as string).toLowerCase();
                    // Key now groups across seasons - same person should have same name everywhere
                    const key = `${normalized}|${participant.distance}|${participant.gender}`;

                    if (!groups.has(key)) {
                        groups.set(key, []);
                    }
                    groups.get(key)!.push(participant);
                }

                // Helper: Count Latvian special characters in a name
                const countLatvianChars = (name: string): number => {
                    const latvianChars = /[āčēģīķļņšūž]/gi;
                    return (name.match(latvianChars) || []).length;
                };

                // Helper: Check if name has natural casing (not all uppercase)
                const hasNaturalCasing = (name: string): boolean => {
                    // Natural casing has at least one lowercase letter
                    return /[a-zāčēģīķļņšūž]/.test(name);
                };

                // Step 3: Find groups with duplicates and determine which to keep
                const mergeActions: Array<{
                    oldId: number;
                    oldName: string;
                    newId: number;
                    newName: string;
                    season: string;
                }> = [];

                for (const [key, participants] of groups.entries()) {
                    if (participants.length > 1) {
                        // Filter out exact duplicates (same name, not just normalized)
                        const uniqueNames = new Set(participants.map(p => p.name));
                        if (uniqueNames.size === 1) {
                            // All have identical names already, skip
                            continue;
                        }

                        // Sort by preference:
                        // 1. More Latvian special characters (ā vs a)
                        // 2. Natural casing over all-uppercase
                        // 3. Lower ID (original record)
                        participants.sort((a, b) => {
                            const aName = a.name as string;
                            const bName = b.name as string;

                            // Prefer more Latvian characters
                            const aLatvianCount = countLatvianChars(aName);
                            const bLatvianCount = countLatvianChars(bName);
                            if (aLatvianCount !== bLatvianCount) {
                                return bLatvianCount - aLatvianCount;
                            }

                            // Prefer natural casing
                            const aNatural = hasNaturalCasing(aName);
                            const bNatural = hasNaturalCasing(bName);
                            if (aNatural !== bNatural) {
                                return aNatural ? -1 : 1;
                            }

                            // Tie-break by ID (prefer older record)
                            return (a.id as number) - (b.id as number);
                        });

                        const keeper = participants[0];

                        // All others should be merged into the keeper
                        for (let i = 1; i < participants.length; i++) {
                            mergeActions.push({
                                oldId: participants[i].id as number,
                                oldName: participants[i].name as string,
                                newId: keeper.id as number,
                                newName: keeper.name as string,
                                season: keeper.season as string,
                            });
                        }
                    }
                }

                if (isPreview) {
                    // Just return what would be merged
                    return Response.json({
                        preview: true,
                        totalMerges: mergeActions.length,
                        uniqueKeepers: new Set(mergeActions.map(a => a.newId)).size,
                        actions: mergeActions,
                    }, { headers });
                }

                // Step 4: Execute the merge (not a preview)
                let updatedRaces = 0;
                let deletedParticipants = 0;

                // Update race records to point to keeper participants
                for (const action of mergeActions) {
                    const result = await env.DB.prepare(`
                        UPDATE races
                        SET participant_id = ?
                        WHERE participant_id = ?
                    `).bind(action.newId, action.oldId).run();

                    updatedRaces += result.meta.changes || 0;
                }

                // Delete duplicate participant records
                for (const action of mergeActions) {
                    const result = await env.DB.prepare(`
                        DELETE FROM participants WHERE id = ?
                    `).bind(action.oldId).run();

                    deletedParticipants += result.meta.changes || 0;
                }

                return Response.json({
                    success: true,
                    totalMerges: mergeActions.length,
                    uniqueKeepers: new Set(mergeActions.map(a => a.newId)).size,
                    updatedRaces,
                    deletedParticipants,
                    actions: mergeActions,
                }, { headers });

            } catch (e) {
                return Response.json({
                    error: (e as Error).message,
                    stack: (e as Error).stack,
                }, { status: 500, headers });
            }
        }

        return new Response("Not Found", { status: 404, headers });
    },
};
