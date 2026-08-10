import { prisma } from "@/lib/prisma";
import { AgencyForm, DeleteButton } from "./AgencyForm";
import { Tv, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const agencies = await prisma.agency.findMany({
    include: {
      devices: true,
    },
    orderBy: { number: "asc" },
  });

  return (
    <div className="p-8 sm:p-10 font-[family-name:var(--font-geist-sans)]">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Agencias y Pantallas</h1>
          <p className="text-muted mt-2">Gestión de sucursales autorizadas y terminales de reproducción activa.</p>
        </div>
        <AgencyForm />
      </div>

      <div className="glass rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-hover/50 border-b border-border">
              <th className="px-6 py-4 text-sm font-semibold text-white">N° Sucursal</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Detalle / Zona</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Pantallas TV</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Estado RED</th>
              <th className="px-6 py-4 text-sm font-semibold text-white text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agencies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted">
                  No hay agencias registradas aún.
                </td>
              </tr>
            ) : (
              agencies.map((agency) => (
                <tr key={agency.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white text-lg">
                    Agencia {agency.number.toString().padStart(2, "0")}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {agency.name || <span className="italic opacity-50">Sin especificar</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-primary" />
                      <span className="font-medium text-white">{agency.devices.length}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      if (agency.devices.length === 0) {
                        return <span className="text-sm px-2 py-0.5 rounded-full border border-muted/20 bg-muted/10 text-muted">Sin TVs</span>;
                      }
                      const now = Date.now();
                      const isOnline = agency.devices.some(d => (now - new Date(d.last_seen).getTime()) / 1000 < 60);
                      
                      return isOnline ? (
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-sm px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary">Operativo</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-danger" />
                          <span className="text-sm px-2 py-0.5 rounded-full border border-danger/20 bg-danger/10 text-danger">Caída (Offline)</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={agency.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
