import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";
import { Settings as SettingsIcon } from "lucide-react";
import { requireAdmin } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: ['FLUSSONIC_BASE_URL', 'FLUSSONIC_POLL_INTERVAL', 'PRIMARY_API_URL', 'SECONDARY_API_URL'] } },
    orderBy: { key: 'asc' }
  });

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          Configuración del Sistema
        </h1>
        <p className="text-muted mt-2">
          Transmisión en vivo y servidores. Las variables internas se administran automáticamente.
        </p>
      </div>

      <div className="glass rounded-2xl border border-border p-6 shadow-xl">
        <SettingsClient initialConfigs={configs} />
      </div>
    </div>
  );
}
