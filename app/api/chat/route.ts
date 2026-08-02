import { NextResponse } from "next/server";
import { getTamsarCsReply, type ChatMessage } from "@/services/chat.service";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { messages?: ChatMessage[] };
        const messages = Array.isArray(body.messages)
            ? body.messages
                .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
                .slice(-10)
            : [];
        const reply = await getTamsarCsReply(messages);

        return NextResponse.json({ ok: true, reply });
    } catch {
        return NextResponse.json({ ok: false, error: "Permintaan chat tidak valid." }, { status: 400 });
    }
}