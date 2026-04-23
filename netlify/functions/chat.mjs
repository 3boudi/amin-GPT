// Netlify Serverless Function — Secure NVIDIA API Proxy

const DEFAULT_MODEL = "meta/llama-3.1-405b-instruct";
const ALLOWED_MODELS = new Set([
    "meta/llama-3.1-405b-instruct",
    "meta/llama-3.2-3b-instruct"
]);

const jsonResponse = (status, payload) => {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" }
    });
};

const toHost = (value) => {
    try {
        return new URL(value).host;
    } catch {
        return null;
    }
};

const getAllowedHosts = () => {
    const hosts = new Set();
    const candidates = [
        process.env.URL,
        process.env.DEPLOY_PRIME_URL,
        process.env.SITE_URL
    ].filter(Boolean);

    for (const candidate of candidates) {
        const host = toHost(candidate);
        if (host) hosts.add(host);
    }

    const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    for (const origin of extraAllowedOrigins) {
        const host = toHost(origin);
        if (host) hosts.add(host);
    }

    if (process.env.NODE_ENV !== "production") {
        hosts.add("localhost:5173");
        hosts.add("localhost:8888");
    }

    return hosts;
};

const sanitizeMessages = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return null;
    }

    const cleaned = [];

    for (const msg of messages) {
        const role = msg?.role;
        const content = msg?.content;

        if (!["user", "assistant", "system"].includes(role)) {
            return null;
        }

        if (typeof content !== "string") {
            return null;
        }

        const trimmed = content.trim();
        if (!trimmed) {
            return null;
        }

        cleaned.push({ role, content: trimmed });
    }

    return cleaned;
};

export default async (request) => {
    // 1. Only allow POST
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed" });
    }

    // 2. Strict origin validation
    const requestOrigin = request.headers.get("origin") || request.headers.get("referer");
    const originHost = requestOrigin ? toHost(requestOrigin) : null;
    const allowedHosts = getAllowedHosts();

    if (!originHost || !allowedHosts.has(originHost)) {
        return jsonResponse(403, { error: "Unauthorized origin" });
    }

    const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

    if (!TURNSTILE_SECRET_KEY || !NVIDIA_API_KEY) {
        return jsonResponse(500, { error: "Server security configuration is incomplete" });
    }

    const connectionIp = request.headers.get("x-nf-client-connection-ip")
        || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "unknown";

    try {
        const body = await request.json();
        const { messages, model, turnstile_token } = body ?? {};

        const cleanedMessages = sanitizeMessages(messages);
        if (!cleanedMessages) {
            return jsonResponse(400, { error: "Invalid payload: messages are not valid" });
        }

        if (typeof turnstile_token !== "string" || !turnstile_token.trim()) {
            return jsonResponse(403, { error: "Security token missing. Access denied." });
        }

        // 3. Verify Turnstile token with Cloudflare before calling NVIDIA.
        const verificationBody = new URLSearchParams();
        verificationBody.set("secret", TURNSTILE_SECRET_KEY);
        verificationBody.set("response", turnstile_token);
        if (connectionIp && connectionIp !== "unknown") {
            verificationBody.set("remoteip", connectionIp);
        }

        const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: verificationBody
        });

        if (!turnstileResponse.ok) {
            return jsonResponse(502, { error: "Security verification unavailable" });
        }

        const turnstileResult = await turnstileResponse.json();
        if (!turnstileResult?.success) {
            console.error("Turnstile verification failed", turnstileResult?.["error-codes"] || []);
            return jsonResponse(403, { error: "Security verification failed" });
        }

        const requestedModel = typeof model === "string" ? model : "";
        const safeModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

        const safePayload = {
            model: safeModel,
            messages: cleanedMessages,
            max_tokens: 1024,
            stream: true
        };

        const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NVIDIA_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            body: JSON.stringify(safePayload)
        });

        if (!nvidiaResponse.ok) {
            const errorText = await nvidiaResponse.text();
            console.error("NVIDIA API Error:", errorText);
            return jsonResponse(nvidiaResponse.status, { error: "An error occurred with the upstream AI provider." });
        }

        // Stream the SSE response back to the client.
        return new Response(nvidiaResponse.body, {
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    } catch (error) {
        console.error("Unhandled execution error:", error);
        return jsonResponse(500, { error: "Internal server error" });
    }
};
