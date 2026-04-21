// Netlify Serverless Function — Secure NVIDIA API Proxy
// The API key is stored as a Netlify environment variable (NVIDIA_API_KEY)
// and NEVER exposed to the browser.

export default async (request) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    const NVIDIA_API_KEY = Netlify.env.get("NVIDIA_API_KEY");
    if (!NVIDIA_API_KEY) {
        return new Response(JSON.stringify({ error: "API key not configured on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await request.json();

        // Forward the request to NVIDIA with the secret key
        const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NVIDIA_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            body: JSON.stringify(body)
        });

        if (!nvidiaResponse.ok) {
            const errorText = await nvidiaResponse.text();
            return new Response(errorText, {
                status: nvidiaResponse.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Stream the SSE response back to the client
        return new Response(nvidiaResponse.body, {
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config = {
    path: "/.netlify/functions/chat"
};
