import { proxyAgentAuthPost } from "@/lib/agent-auth-proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return proxyAgentAuthPost(request, "/api/auth/forgot-password");
}
