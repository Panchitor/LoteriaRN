import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EDITOR_FEATURE_KEYS, resolveEditorFeatures } from "@/lib/editorFeatures";

export const metadata: Metadata = {
  title: "Lotería RN",
  description: "Administración de Cartelería",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const editorFeatureConfigs = session ? await prisma.systemConfig.findMany({
    where: { key: { in: Object.values(EDITOR_FEATURE_KEYS) } },
    select: { key: true, value: true },
  }) : [];
  const editorFeatures = resolveEditorFeatures(editorFeatureConfigs);
  return (
    <html lang="es" className="dark">
      <body suppressHydrationWarning className="antialiased selection:bg-primary/30 selection:text-white">
        <div className="flex h-screen bg-background overflow-hidden text-white">
          <Sidebar role={session?.role} username={session?.username} editorFeatures={editorFeatures} />
          <main className="flex-1 overflow-y-auto w-full relative">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
