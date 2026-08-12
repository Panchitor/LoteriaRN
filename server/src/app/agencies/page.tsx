import { prisma } from "@/lib/prisma";
import { AgencyForm, DeleteButton, DeviceActions } from "./AgencyForm";
import { Tv, Activity } from "lucide-react";
import { getDeviceOperationalState, operationalStateLabel } from "@/lib/deviceStatus";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const agencies = await prisma.agency.findMany({
    include: {
      devices: true,
    },
    orderBy: [{ number: "asc" }, { subagency_number: "asc" }],
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
              <th className="px-6 py-4 text-sm font-semibold text-white">Subagencia</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Ciudad</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Pantallas TV</th>
              <th className="px-6 py-4 text-sm font-semibold text-white">Estado RED</th>
              <th className="px-6 py-4 text-sm font-semibold text-white text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agencies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted">
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
                    {agency.subagency_number ? `Subagencia ${agency.subagency_number}` : "Sin subagencia"}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {agency.city || <span className="italic opacity-50">Sin especificar</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-primary" />
                      <div className="font-medium text-white">
                        {agency.devices.length === 0 ? "Sin TVs" : agency.devices.map(d => (
                          <div key={d.id} className="mb-2">
                            <div>TV {d.tv_number || "?"} · {!d.is_active ? "Inactivo" : d.installation_id && !d.revoked_at ? "Vinculado" : "Sin vincular"}</div>
                            <Link href={`/monitoring/${d.id}`} className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-xs text-cyan-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200">
                              <Activity className="h-3 w-3" /> Ver monitoreo
                            </Link>
                            <DeviceActions id={d.id} isLinked={Boolean(d.installation_id && !d.revoked_at)} isActive={d.is_active} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      if (agency.devices.length === 0) {
                        return <span className="text-sm px-2 py-0.5 rounded-full border border-muted/20 bg-muted/10 text-muted">Sin TVs</span>;
                      }
                      const now = Date.now();
                      const states = agency.devices.map(d => getDeviceOperationalState(d, now));
                      const state = states.includes("online") ? "online" : states.includes("delayed") ? "delayed" : states.includes("offline") ? "offline" : states.includes("unlinked") ? "unlinked" : "inactive";
                      const color = state === "online" ? "border-primary/20 bg-primary/10 text-primary" : state === "delayed" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : state === "offline" ? "border-danger/20 bg-danger/10 text-danger" : "border-slate-500/20 bg-slate-500/10 text-slate-400";
                      return <div className="flex items-center gap-2"><Activity className="h-4 w-4" /><span className={`text-sm px-2 py-0.5 rounded-full border ${color}`}>{operationalStateLabel(state)}</span></div>;
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
