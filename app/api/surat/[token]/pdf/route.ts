import { type NextRequest } from "next/server";
import { renderOfficialLetterPdfRoute } from "@/services/official-letter-pdf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
    return renderOfficialLetterPdfRoute(request, context);
}
