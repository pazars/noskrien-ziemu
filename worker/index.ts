
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
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // Simple router
        if (url.pathname === "/api/results") {
            // Query parameters
            const name = url.searchParams.get("name");

            if (!name || name.length < 2) {
                return Response.json([], { headers });
            }

            // Return DISTINCT names matching query
            // Group by name/gender to avoid duplicates
            // We select one ID just to have a key, but frontend should rely on name
            // Search both original and normalized (Latvian-insensitive) versions
            const normalizedQuery = normalizeLatvian(name);
            const query = `
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
                GROUP BY name, gender
                LIMIT 10
            `;

            try {
                const { results } = await env.DB.prepare(query)
                    .bind(`%${name}%`, `%${normalizedQuery}%`)
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

        return new Response("Not Found", { status: 404, headers });
    },
};
