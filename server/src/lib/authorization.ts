import { getSession, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isEditorFeatureEnabled } from "@/lib/editorFeatures";

export async function requireSession(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin(): Promise<AuthUser> {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

export async function requireEditorFeature(key: string, defaultEnabled: boolean): Promise<AuthUser> {
  const session = await requireSession();
  if (session.role === "ADMIN") return session;
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  if (!isEditorFeatureEnabled(config?.value, defaultEnabled)) redirect("/");
  return session;
}
