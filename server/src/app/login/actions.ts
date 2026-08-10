"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/hash";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Debes ingresar usuario y contraseña." };
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user) {
    return { error: "Usuario no encontrado." };
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { error: "Contraseña incorrecta." };
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
