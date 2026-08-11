import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database, Film, HardDrive,
  Image as ImageIcon, MonitorPlay, Radio, Server, ShieldAlert, Tv, WifiOff,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import Link from "next/link";
import { getDeviceOperationalState } from "@/lib/deviceStatus";

export const dynamic = "force-dynamic";

const GB = 1024 * 1024 * 1024;

export default async function DashboardPage() {
  const [devices, videos, liveEvent, latestVersionConfig] = await Promise.all([
    prisma.device.findMany({ include: { agency: true }, orderBy: { last_seen: "desc" } }),
    prisma.video.findMany({ orderBy: { order: "asc" } }),
    prisma.liveEvent.findFirst(),
    prisma.systemConfig.findUnique({ where: { key: "LATEST_APK_VERSION" } }),
  ]);

  const now = Date.now();
  const latestVersion = latestVersionConfig?.value || "Sin definir";
  const terminals = devices.map(device => {
    const ageSeconds = (now - device.last_seen.getTime()) / 1000;
    const linked = Boolean(device.installation_id && !device.revoked_at);
    const operationalState = getDeviceOperationalState(device, now);
    return { ...device, ageSeconds, linked, operationalState, isOnline: operationalState === "online" };
  });

  const linked = terminals.filter(d => d.linked && d.is_active);
  const online = linked.filter(d => d.isOnline);
  const delayed = linked.filter(d => d.operationalState === "delayed");
  const offline = linked.filter(d => d.operationalState === "offline");
  const unlinked = terminals.filter(d => d.operationalState === "unlinked");
  const inactive = terminals.filter(d => d.operationalState === "inactive");
  const playbackErrors = linked.filter(d => d.playback_status === "error");
  const lowStorage = online.filter(d => d.free_space !== null && Number(d.free_space) < 2 * GB);
  const outdated = linked.filter(d => d.app_version && latestVersion !== "Sin definir" && d.app_version !== latestVersion);
  const alertIds = new Set([...delayed, ...offline, ...playbackErrors, ...lowStorage, ...outdated].map(d => d.id));
  const healthPercent = linked.length ? Math.round((online.length / linked.length) * 100) : 100;

  const playbackCounts = {
    live: online.filter(d => d.playback_status === "live").length,
    loop: online.filter(d => d.playback_status === "offline" || d.playback_status === "playing").length,
    other: online.filter(d => !["live", "offline", "playing", "error"].includes(d.playback_status || "")).length,
    error: playbackErrors.length,
  };
  const versionCounts = Array.from(linked.reduce((map, d) => {
    const version = d.app_version || "Sin versión";
    map.set(version, (map.get(version) || 0) + 1);
    return map;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);

  const reportedStorage = online.filter(d => d.free_space !== null);
  const averageFreeGB = reportedStorage.length
    ? reportedStorage.reduce((sum, d) => sum + Number(d.free_space), 0) / reportedStorage.length / GB
    : 0;
  const videoCount = videos.filter(v => v.media_type === "video").length;
  const imageCount = videos.filter(v => v.media_type === "image").length;
  const totalMediaMB = videos.reduce((sum, v) => sum + Number(v.size_bytes), 0) / (1024 * 1024);

  return (
    <div className="p-5 pb-16 sm:p-8 lg:p-10">
      <AutoRefresh intervalMs={10000} />
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Centro de operaciones</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Estado general de la red</h1>
          <p className="mt-2 text-sm text-muted">Información actualizada automáticamente cada 10 segundos.</p>
        </div>
        <div className={`inline-flex w-fit items-center gap-3 rounded-xl border px-4 py-3 ${alertIds.size ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-primary/30 bg-primary/10 text-primary"}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${alertIds.size ? "bg-amber-400" : "bg-primary animate-pulse"}`} />
          <div><p className="text-xs font-bold uppercase tracking-wider">Estado del sistema</p><p className="text-sm font-semibold">{alertIds.size ? `${alertIds.size} terminales requieren atención` : "Operación normal"}</p></div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard href="/monitoring" title="Disponibilidad" value={`${healthPercent}%`} detail={`${online.length} online · ${delayed.length} demorados · ${offline.length} offline`} color="green" icon={<Activity />} />
        <KpiCard href="/live" title="Emisión actual" value={liveEvent?.is_active ? "EN VIVO" : "CONTENIDO"} detail={liveEvent?.is_active ? "Señal central activa" : "Playlist institucional"} color={liveEvent?.is_active ? "red" : "green"} icon={<Radio />} />
        <KpiCard href="/alerts" title="Alertas activas" value={alertIds.size.toString()} detail={alertIds.size ? "Ver detalle y recuperaciones" : "Todo en orden"} color={alertIds.size ? "amber" : "green"} icon={<ShieldAlert />} />
        <KpiCard href="/content" title="Contenido" value={videos.length.toString()} detail={`${videoCount} videos · ${imageCount} imágenes · ${totalMediaMB.toFixed(0)} MB`} color="neutral" icon={<MonitorPlay />} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Salud de terminales" subtitle="Solo dispositivos vinculados" icon={<Server className="h-5 w-5 text-primary" />}>
          <div className="flex items-center gap-7 py-2">
            <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#00c878 0 ${healthPercent}%, #ef3340 ${healthPercent}% 100%)` }}>
              <div className="grid h-24 w-24 place-items-center rounded-full bg-surface text-center shadow-inner"><div><p className="text-3xl font-black text-white">{healthPercent}%</p><p className="text-[10px] uppercase text-muted">disponible</p></div></div>
            </div>
            <div className="flex-1 space-y-3">
              <LegendRow color="bg-primary" label="Online" value={online.length} />
              <LegendRow color="bg-amber-400" label="Demorados" value={delayed.length} />
              <LegendRow color="bg-danger" label="Offline" value={offline.length} />
              <LegendRow color="bg-slate-500" label="Sin vincular" value={unlinked.length} />
              <LegendRow color="bg-slate-700" label="Inactivos" value={inactive.length} />
              <div className="border-t border-border pt-3 text-xs text-muted">{linked.length} terminales vinculadas</div>
            </div>
          </div>
        </Panel>

        <Panel title="Estado de reproducción" subtitle="Terminales online" icon={<Film className="h-5 w-5 text-primary" />}>
          <div className="space-y-5 pt-3">
            <ProgressRow label="Señal en vivo" value={playbackCounts.live} total={Math.max(online.length, 1)} color="bg-danger" />
            <ProgressRow label="Playlist local" value={playbackCounts.loop} total={Math.max(online.length, 1)} color="bg-primary" />
            <ProgressRow label="Otro / iniciando" value={playbackCounts.other} total={Math.max(online.length, 1)} color="bg-cyan-400" />
            <ProgressRow label="Error" value={playbackCounts.error} total={Math.max(linked.length, 1)} color="bg-amber-400" />
          </div>
        </Panel>

        <Panel title="Versiones instaladas" subtitle={`Última publicada: ${latestVersion}`} icon={<Database className="h-5 w-5 text-primary" />}>
          <div className="space-y-4 pt-3">
            {versionCounts.length ? versionCounts.map(([version, count]) => (
              <ProgressRow key={version} label={version} value={count} total={Math.max(linked.length, 1)} color={version === latestVersion ? "bg-primary" : "bg-amber-400"} />
            )) : <EmptyState text="No hay terminales vinculadas" />}
          </div>
        </Panel>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <AlertTile label="Offline" value={offline.length} icon={<WifiOff />} danger={offline.length > 0} />
        <AlertTile label="Demorados" value={delayed.length} icon={<Clock3 />} danger={delayed.length > 0} />
        <AlertTile label="Reproducción" value={playbackErrors.length} icon={<AlertTriangle />} danger={playbackErrors.length > 0} />
        <AlertTile label="Poco espacio" value={lowStorage.length} icon={<HardDrive />} danger={lowStorage.length > 0} />
        <AlertTile label="Desactualizadas" value={outdated.length} icon={<Clock3 />} danger={outdated.length > 0} />
        <AlertTile label="Sin vincular" value={unlinked.length} icon={<Tv />} danger={false} />
        <div className="rounded-2xl border border-border bg-surface/70 p-4"><p className="text-xs text-muted">Espacio libre promedio</p><p className="mt-2 text-2xl font-black text-white">{averageFreeGB.toFixed(1)} GB</p></div>
      </section>

      <Panel title="Actividad de terminales" subtitle="Último contacto y condición operativa" icon={<Tv className="h-5 w-5 text-primary" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><th className="py-3">Terminal</th><th>Ubicación</th><th>Reproducción</th><th>Versión</th><th>Espacio</th><th>Último contacto</th><th className="text-right">Estado</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {terminals.slice(0, 8).map(device => (
                <tr key={device.id} className="text-sm hover:bg-primary/[0.03]">
                  <td className="py-4 font-semibold"><Link href={`/monitoring/${device.id}`} className="text-white hover:text-primary hover:underline">Ag. {device.agency.number}{device.agency.subagency_number ? ` / Sub. ${device.agency.subagency_number}` : ""} · TV {device.tv_number || "?"}</Link></td>
                  <td><Link href={`/monitoring/${device.id}`} className="text-muted hover:text-white hover:underline">{device.agency.city || "Sin ciudad"}</Link></td>
                  <td className="capitalize"><Link href={`/monitoring/${device.id}`} className="text-muted hover:text-white hover:underline">{device.playback_status === "offline" ? "Contenido local" : device.playback_status || "Sin datos"}</Link></td>
                  <td><Link href="/updates" className={`${device.app_version === latestVersion ? "text-primary" : "text-amber-300"} hover:underline`}>{device.app_version || "—"}</Link></td>
                  <td className="text-muted">{device.free_space !== null ? `${(Number(device.free_space) / GB).toFixed(1)} GB` : "—"}</td>
                  <td className="text-muted">{formatElapsed(device.ageSeconds)}</td>
                  <td className="text-right"><Link href={`/monitoring/${device.id}`}><StatusBadge state={device.operationalState} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function KpiCard({ title, value, detail, icon, color, href }: { title: string; value: string; detail: string; icon: React.ReactNode; color: "green" | "red" | "amber" | "neutral"; href?: string }) {
  const styles = { green: "border-primary/25 bg-primary/[0.07] text-primary", red: "border-danger/25 bg-danger/[0.07] text-danger", amber: "border-amber-400/25 bg-amber-400/[0.07] text-amber-300", neutral: "border-border bg-surface/80 text-slate-300" }[color];
  const card = <div className={`relative h-full overflow-hidden rounded-2xl border p-5 ${styles}`}><div className="absolute -right-3 -top-3 opacity-10 [&>svg]:h-24 [&>svg]:w-24">{icon}</div><div className="relative"><p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-2 truncate text-xs text-muted">{detail}</p></div></div>;
  return href ? <Link href={href} className="block h-full transition hover:-translate-y-0.5">{card}</Link> : card;
}
function Panel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="glass rounded-2xl border border-border p-5 shadow-xl"><div className="mb-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2">{icon}</div><div><h2 className="font-bold text-white">{title}</h2><p className="text-xs text-muted">{subtitle}</p></div></div>{children}</div>;
}
function LegendRow({ color, label, value }: { color: string; label: string; value: number }) { return <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm text-muted"><i className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span><strong className="text-white">{value}</strong></div>; }
function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { const pct = Math.min(100, (value / total) * 100); return <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{label}</span><strong className="text-white">{value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-background"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div></div>; }
function AlertTile({ label, value, icon, danger }: { label: string; value: number; icon: React.ReactNode; danger: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? "border-danger/25 bg-danger/[0.06]" : "border-primary/20 bg-primary/[0.05]"}`}><div className={`mb-3 [&>svg]:h-5 [&>svg]:w-5 ${danger ? "text-danger" : "text-primary"}`}>{icon}</div><p className="text-2xl font-black text-white">{value}</p><p className="text-xs text-muted">{label}</p></div>; }
function StatusBadge({ state }: { state: "online" | "delayed" | "offline" | "inactive" | "unlinked" }) { const labels = { online: "Online", delayed: "Demorado", offline: "Offline", inactive: "Inactivo", unlinked: "Sin vincular" }; const colors = { online: "border-primary/30 bg-primary/10 text-primary", delayed: "border-amber-400/30 bg-amber-400/10 text-amber-300", offline: "border-danger/30 bg-danger/10 text-danger", inactive: "border-slate-700 bg-slate-800/50 text-slate-500", unlinked: "border-slate-500/30 bg-slate-500/10 text-slate-400" }; return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${colors[state]}`}>{labels[state]}</span>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border text-sm text-muted">{text}</div>; }
function formatElapsed(seconds: number) { if (seconds < 60) return `Hace ${Math.max(0, Math.floor(seconds))} s`; if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`; if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`; return `Hace ${Math.floor(seconds / 86400)} días`; }
