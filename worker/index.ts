
export interface Env {
    DB: D1Database;
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
            // COLLATE NOCASE ensures case-insensitive search
            const query = `
                SELECT MIN(id) as id, name, gender
                FROM participants
                WHERE name LIKE ? COLLATE NOCASE
                GROUP BY name, gender
                LIMIT 10
            `;

            try {
                const { results } = await env.DB.prepare(query).bind(`%${name}%`).all();
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
