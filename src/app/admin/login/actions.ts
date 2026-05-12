"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, MAX_AGE_SECONDS, signToken } from "@/lib/auth";

type LoginState = { error: string } | null;

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  const envSecret = process.env.ADMIN_COOKIE_SECRET;

  if (!envUser || !envPass || !envSecret) {
    return { error: "Configuração do servidor incompleta. Contate o administrador." };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const userOk = safeCompare(username, envUser);
  const passOk = safeCompare(password, envPass);

  if (!userOk || !passOk) {
    return { error: "Usuário ou senha inválidos." };
  }

  const token = signToken(username);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  redirect("/admin");
}
