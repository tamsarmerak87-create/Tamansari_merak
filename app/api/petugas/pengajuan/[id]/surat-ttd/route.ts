import { type NextRequest } from "next/server";
import { handleOfficialLetterPost } from "@/services/official-letter-finalization";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return handleOfficialLetterPost(request, context);
}
