import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
