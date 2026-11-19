import { prisma } from "@/lib/prisma";
import { Activity, PowerOff, RefreshCw, CheckCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from 'next/link';
import { AutoRefresh } from "@/components/AutoRefresh";
import { getDeviceOperationalState, operationalStateLabel } from "@/lib/deviceStatus";
import { AVAILABILITY_WINDOWS, calculateAvailabilityByDevice, formatAvailabilityPercent } from "@/lib/deviceAvailability";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const now = Date.now();
  const historyStart = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const [devices, availabilityPeriods] = await Promise.all([
    prisma.device.findMany({ include: { agency: true }, orderBy: { last_seen: 'desc' } }),
    prisma.deviceAvailabilityPeriod.findMany({ where: { ended_at: { gte: historyStart } } }),
  ]);
  const availabilityByDevice = calculateAvailabilityByDevice(devices, availabilityPeriods, now);
  
  // Calculate analytics
  const processedDevices = devices.map(device => {
    const diffSec = (now - new Date(device.last_seen).getTime()) / 1000;
    const operationalState = getDeviceOperationalState(device, now);
    return { ...device, operationalState, isOnline: operationalState === "online", diffSec };
  });

  const onlineCount = processedDevices.filter(d => d.isOnline).length;
  const delayedCount = processedDevices.filter(d => d.operationalState === "delayed").length;
  const offlineCount = processedDevices.filter(d => d.operationalState === "offline").length;
  const inactiveCount = processedDevices.filter(d => d.operationalState === "inactive").length;
  const totalCount = processedDevices.filter(d => d.operationalState !== "inactive").length;
  const trackedDevices = processedDevices.filter(device => device.operationalState !== "inactive" && device.availability_tracking_since);
  const networkAvailability = Object.fromEntries(AVAILABILITY_WINDOWS.map(window => {
    const values = trackedDevices
      .map(device => availabilityByDevice.get(device.id)?.[window.key].percent)
      .filter((value): value is number => value !== null && value !== undefined);
    return [window.key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null];
  })) as Record<(typeof AVAILABILITY_WINDOWS)[number]["key"], number | null>;

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-[1600px] mx-auto w-full">
      <AutoRefresh intervalMs={3000} />
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Control de Nodos
          </h1>
          <p className="text-muted mt-2">Monitoreo de estado de reproductores en agencias al estilo Grafana.</p>
        </div>
        
        <form action={async () => {
          'use server';
          revalidatePath('/monitoring');
        }}>
           <button className="flex items-center gap-2 bg-[#1f2937] hover:bg-[#374151] text-white px-5 py-2.5 rounded-sm font-medium transition-colors border border-[#374151] shadow">
             <RefreshCw className="h-4 w-4" />
             Actualizar Ahora
           </button>
        </form>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {AVAILABILITY_WINDOWS.map(window => (
          <div key={window.key} className="rounded-xl border border-primary/20 bg-primary/[0.05] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Disponibilidad · {window.label}</p>
            <p className="mt-2 text-3xl font-black text-white">{formatAvailabilityPercent(networkAvailability[window.key])}</p>
            <p className="mt-1 text-xs text-muted">Promedio de terminales con historial</p>
          </div>
        ))}
      </div>

      {/* Top Main Grafana-style Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-[#181b1f] border-t-2 border-t-blue-500 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[150px]">
          <div className="text-xs font-bold text-blue-400 mb-1 uppercase tracking-wider">Total Agencias</div>
          <div className="text-7xl font-black text-white">{totalCount}</div>
        </div>
        
        <div className="bg-[#122818] border-t-2 border-t-green-500 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[150px]">
          <div className="text-xs font-bold text-green-400 mb-1 uppercase tracking-wider flex justify-between">
            Online <CheckCircle className="h-4 w-4 opacity-50" />
          </div>
          <div className="text-7xl font-black text-[#56f082]">{onlineCount}</div>
        </div>
        
        <div className="bg-[#361313] border-t-2 border-t-red-500 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[150px]">
          <div className="text-xs font-bold text-red-500 mb-1 uppercase tracking-wider flex justify-between">
            Caídas (Offline) <PowerOff className="h-4 w-4 opacity-50" />
          </div>
          <div className="text-7xl font-black text-[#ff6666]">{offlineCount}</div>
        </div>
        <div className="bg-amber-950/40 border-t-2 border-t-amber-400 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[150px]">
          <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Demorados</div>
          <div className="text-7xl font-black text-amber-300">{delayedCount}</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-slate-600 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[150px]">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inactivos</div>
          <div className="text-7xl font-black text-slate-500">{inactiveCount}</div>
        </div>
      </div>

      <div className="mb-4">
         <h3 className="text-sm font-bold text-muted uppercase tracking-widest border-b border-[#374151] pb-2">Topología de Red</h3>
      </div>

      {/* Grid of Agencies */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-3">
        {processedDevices.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted">No hay agencias conectadas.</div>
        ) : (
          processedDevices.map(device => {
            const diff = Math.floor(device.diffSec);
            const stateStyles = {
              online: "bg-[#163620] border-l-[#32d74b] text-[#d4f8da]",
              delayed: "bg-amber-950/50 border-l-amber-400 text-amber-100",
              offline: "bg-[#3d1616] border-l-[#ff453a] text-[#fedada]",
              inactive: "bg-slate-900 border-l-slate-600 text-slate-500",
              unlinked: "bg-slate-900 border-l-slate-400 text-slate-300",
            }[device.operationalState];
            const stateText = { online: "text-[#32d74b]", delayed: "text-amber-300", offline: "text-[#ff453a]", inactive: "text-slate-500", unlinked: "text-slate-300" }[device.operationalState];
            
            return (
              <Link 
                href={`/monitoring/${device.id}`}
                key={device.id}
                className={`group flex flex-col justify-between border-l-4 p-4 h-[110px] cursor-pointer hover:brightness-125 transition-all ${stateStyles}`}
              >
                <div className="flex justify-between items-start w-full">
                   <div className="text-xl font-black tracking-tight">
                     AG {device.agency.number}
                     <div className="text-xs font-mono break-all">{device.asset_label || 'Sin etiqueta'}</div>
                   </div>
                   {device.operationalState === "online" ? (
                     <div className="w-2 h-2 rounded-full bg-[#32d74b] animate-pulse shadow-[0_0_5px_rgba(50,215,75,0.8)]"></div>
                   ) : (
                     <div className="w-2 h-2 rounded-full bg-[#ff453a] shadow-[0_0_5px_rgba(255,69,58,0.8)]"></div>
                   )}
                </div>
                
                <div className="mt-auto flex flex-col gap-0.5">
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${stateText}`}>
                    {operationalStateLabel(device.operationalState)}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono opacity-60">
                      Lat. {diff}s
                    </div>
                    {device.app_version && (
                      <div className="text-[10px] font-mono font-bold px-1 rounded bg-black/20" title="Versión del APK">
                        v{device.app_version}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[9px] font-mono opacity-70">
                    24 h {formatAvailabilityPercent(availabilityByDevice.get(device.id)?.day.percent ?? null)} · 7 d {formatAvailabilityPercent(availabilityByDevice.get(device.id)?.week.percent ?? null)} · 30 d {formatAvailabilityPercent(availabilityByDevice.get(device.id)?.month.percent ?? null)}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  );
}
