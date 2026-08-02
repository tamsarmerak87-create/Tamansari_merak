import { NextResponse } from "next/server";
import { forwardToN8n } from "@/services/integrations";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const secret = req.headers.get("x-webhook-secret");

    if (process.env.N8N_WEBHOOK_SECRET && secret !== process.env.N8N_WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false, error: "Unauthorized webhook" }, { status: 401 });
    }

    const result = await forwardToN8n(String(body.flow ?? "webhook"), body);
    return NextResponse.json({ ok: true, result });
}