import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Endpoint belum diimplementasikan." },
    { status: 501 },
  );
}
