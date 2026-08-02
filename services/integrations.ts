type Json = Record<string, unknown>;

type ServiceConfig = {
    baseUrl?: string;
    apiKey?: string;
    token?: string;
};

function normalizeUrl(url?: string) {
    return url?.trim().replace(/\/$/, "");
}

function getConfig(prefix: string): ServiceConfig {
    return {
        baseUrl: normalizeUrl(process.env[`${prefix}_BASE_URL`]),
        apiKey: process.env[`${prefix}_API_KEY`],
        token: process.env[`${prefix}_TOKEN`],
    };
}

async function postJson(url: string, body: Json, headers: HeadersInit = {}) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

export function getAppBaseUrl() {
    return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000";
}

export async function forwardToN8n(flow: string, payload: Json) {
    const baseUrl = normalizeUrl(process.env.N8N_BASE_URL);
    if (!baseUrl) return { skipped: true, reason: "N8N_BASE_URL belum diisi" };
    return postJson(`${baseUrl}/${flow}`, payload, process.env.N8N_WEBHOOK_SECRET ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET } : undefined);
}

export async function sendToEvolutionApi(endpoint: string, payload: Json) {
    const config = getConfig("EVOLUTION");
    if (!config.baseUrl) return { skipped: true, reason: "EVOLUTION_BASE_URL belum diisi" };
    return postJson(`${config.baseUrl}/${endpoint}`, payload, config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined);
}

export async function sendToChatwoot(endpoint: string, payload: Json) {
    const config = getConfig("CHATWOOT");
    if (!config.baseUrl) return { skipped: true, reason: "CHATWOOT_BASE_URL belum diisi" };
    return postJson(`${config.baseUrl}/${endpoint}`, payload, config.token ? { api_access_token: config.token } : undefined);
}

export async function askAiTamsar(prompt: string, context: Json = {}) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const siteUrl = getAppBaseUrl();

    if (geminiKey) {
        return postJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
            contents: [{ role: "user", parts: [{ text: `${prompt}\n\nKonteks: ${JSON.stringify(context)}` }] }],
            generationConfig: { temperature: 0.4 },
            systemInstruction: { parts: [{ text: `Kamu adalah AI TAMSAR untuk website ${siteUrl}. Jawab singkat, informatif, dan sopan.` }] },
        });
    }

    if (openaiKey) {
        return postJson("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `Kamu adalah AI TAMSAR untuk website ${siteUrl}. Jawab singkat, informatif, dan sopan.` },
                { role: "user", content: `${prompt}\n\nKonteks: ${JSON.stringify(context)}` },
            ],
            temperature: 0.4,
        }, { Authorization: `Bearer ${openaiKey}` });
    }

    return { skipped: true, reason: "GEMINI_API_KEY atau OPENAI_API_KEY belum diisi" };
}

export async function createWebhookRelay(channel: "n8n" | "evolution" | "chatwoot" | "ai", payload: Json) {
    if (channel === "n8n") return forwardToN8n("webhook", payload);
    if (channel === "evolution") return sendToEvolutionApi("webhook", payload);
    if (channel === "chatwoot") return sendToChatwoot("api/v1/inboxes", payload);
    return askAiTamsar(String(payload.prompt ?? ""), payload);
}
