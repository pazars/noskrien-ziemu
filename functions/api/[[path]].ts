
import { normalizeLatvian } from '../../src/utils/latvian';

export interface Env {
    DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env, next } = context;
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

        // Normalize the search query
        const normalizedQuery = normalizeLatvian(name).toLowerCase();

        // Build query using normalized_name field (simple, no REPLACE chains)
        let query = `
            SELECT MIN(id) as id, name, gender
            FROM participants
            WHERE normalized_name LIKE ?
        `;

        const bindings: string[] = [`%${normalizedQuery}%`];

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

    // Get full history by ID (returns participant data + races)
    if (url.pathname === "/api/history") {
        const id = url.searchParams.get("id");
        if (!id) {
            return Response.json({ error: "ID required" }, { status: 400, headers });
        }

        try {
            // Get participant data
            const participant = await env.DB.prepare(`
                SELECT id, name, gender, distance, season, normalized_name
                FROM participants
                WHERE id = ?
            `).bind(id).first();

            if (!participant) {
                return Response.json({ error: "Participant not found" }, { status: 404, headers });
            }

            // Get all races for this participant
            const { results: races } = await env.DB.prepare(`
                SELECT date, result, km, location
                FROM races
                WHERE participant_id = ?
                ORDER BY date ASC
            `).bind(id).all();

            return Response.json({ participant, races }, { headers });
        } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 500, headers });
        }
    }

    // New endpoint: Get detailed participant info + races
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


    // Default: try to serve static assets or 404
    return next();
};
