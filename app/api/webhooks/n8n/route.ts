import { NextResponse } from "next/server";
import { forwardToN8n } from "@/services/integrations";
export async function POST(req: Request) { const body = await req.json().catch(() => ({})); const result = await forwardToN8n("webhook", body); return NextResponse.json({ ok: true, result }); }