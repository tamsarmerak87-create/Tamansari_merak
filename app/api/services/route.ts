import { NextResponse } from "next/server";
import { publicRepository } from "@/services/repository";
export async function GET() { return NextResponse.json({ ok: true, data: await publicRepository.getServices() }); }