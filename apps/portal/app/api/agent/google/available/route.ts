import { NextResponse } from "next/server";
import { isGoogleSignInAvailable } from "@/lib/agent-google";

export async function GET() {
  const available = await isGoogleSignInAvailable();
  return NextResponse.json({ available });
}
