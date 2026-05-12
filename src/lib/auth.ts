import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "admin_session";
export const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

function hmac(data: string): string {
  return createHmac("sha256", process.env.ADMIN_COOKIE_SECRET ?? "")
    .update(data)
    .digest("base64url");
}

export function signToken(username: string): string {
  const payload = Buffer.from(`${username}:${Date.now()}`).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
    const ts = Number(
      Buffer.from(payload, "base64url").toString("utf8").split(":")[1],
    );
    return Date.now() - ts < MAX_AGE_SECONDS * 1000;
  } catch {
    return false;
  }
}
