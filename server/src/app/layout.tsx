import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

import { getSession } from "@/lib/auth";

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
  return (
    <html lang="es" className="dark">
      <body suppressHydrationWarning className="antialiased selection:bg-primary/30 selection:text-white">
        <div className="flex h-screen bg-background overflow-hidden text-white">
          <Sidebar role={session?.role} username={session?.username} />
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
