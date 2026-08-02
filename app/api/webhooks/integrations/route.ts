import { NextResponse } from "next/server";
import { createWebhookRelay } from "@/services/integrations";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const channel = String(body.channel ?? "n8n") as "n8n" | "evolution" | "chatwoot" | "ai";

    if (!["n8n", "evolution", "chatwoot", "ai"].includes(channel)) {
        return NextResponse.json({ ok: false, error: "Channel tidak valid" }, { status: 400 });
    }

    const result = await createWebhookRelay(channel, body);
    return NextResponse.json({ ok: true, channel, result });
}