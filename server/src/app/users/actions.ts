"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, created_at: true },
    orderBy: { created_at: 'desc' }
  });
  return users;
}

export async function createUser(data: FormData) {
  const username = data.get("username") as string;
  const password = data.get("password") as string;
  const role = data.get("role") as string;

  if (!username || !password || !role) {
    return { error: "Todos los campos son requeridos." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { error: "El nombre de usuario ya está en uso." };
  }

  const password_hash = await hashPassword(password);

  await prisma.user.create({
    data: {
      username,
      password_hash,
      role
    }
  });

  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(id: string) {
  // Prevent deleting the very last admin
  const user = await prisma.user.findUnique({ where: { id } });
  if (user?.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return { error: "No puedes eliminar al único administrador del sistema." };
    }
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
  return { success: true };
}

export async function changePassword(id: string, newPass: string) {
  if (!newPass) return { error: "La contraseña no puede estar vacía." };
  const password_hash = await hashPassword(newPass);
  
  await prisma.user.update({
    where: { id },
    data: { password_hash }
  });
  
  return { success: true };
}
