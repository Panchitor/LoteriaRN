"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/hash";
import { headers } from "next/headers";
import { consumeRateLimit, opaqueRateKey } from "@/lib/requestGuards";

// Keep the password-check cost similar even when the username does not exist.
const DUMMY_PASSWORD_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    return { error: "Debes ingresar usuario y contraseña." };
  }

  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
  const retryAfter = consumeRateLimit("login", opaqueRateKey(`${address}:${username.toLowerCase()}`), 8, 15 * 60 * 1000);
  if (retryAfter !== null) return { error: `Demasiados intentos. Volvé a probar en ${retryAfter} segundos.` };

  const user = await prisma.user.findUnique({
    where: { username }
  });

  const isValid = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !isValid) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role as "ADMIN" | "EDITOR"
  });

  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
