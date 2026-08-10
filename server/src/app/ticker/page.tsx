import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { TickerClient } from "./TickerClient";

export const dynamic = "force-dynamic";

export default async function TickerPage() {
  const tickers = await prisma.ticker.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-7xl mx-auto w-full">
      <AutoRefresh intervalMs={3000} />
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Marquesina</h1>
        <p className="text-muted mt-2">Configura el texto desplazable (ticker) para las pantallas.</p>
      </div>

      <TickerClient tickers={tickers} />
    </div>
  );
}
