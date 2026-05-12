import { type NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";

function base64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyTokenEdge(token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const secret = process.env.ADMIN_COOKIE_SECRET ?? "";
  if (!secret) return false;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = base64urlToBytes(sig);
    return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value ?? "";
  if (await verifyTokenEdge(token)) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
