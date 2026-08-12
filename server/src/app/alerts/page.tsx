import Link from "next/link";
import { AlertTriangle, CheckCircle2, History, RefreshCw, ShieldAlert, Tv } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getDeviceOperationalState } from "@/lib/deviceStatus";

export const dynamic = "force-dynamic";

const GB = 1024 * 1024 * 1024;

type Incident = {
  key: string;
  deviceId: string;
  date: Date;
  agency: string;
  city: string;
  tv: string;
  type: string;
  detail: string;
  count: number | null;
  status: "active" | "recovered";
};

function deviceLabel(device: { agency: { number: number; subagency_number: number | null } }) {
  return `Agencia ${device.agency.number}${device.agency.subagency_number ? ` / Subagencia ${device.agency.subagency_number}` : ""}`;
}

function recoveryType(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("watchdog") && normalized.includes("vivo")) return "Vivo congelado";
  if (normalized.includes("watchdog") && normalized.includes("video local")) return "Video congelado";
  if (normalized.includes("buffering timeout")) return "Demora del vivo";
  return "Recuperación del reproductor";
}

export default async function AlertsPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [devices, recoveryLogs, latestVersionConfig] = await Promise.all([
    prisma.device.findMany({ include: { agency: true }, orderBy: { last_seen: "desc" } }),
    prisma.deviceLog.findMany({
      where: {
        created_at: { gte: since },
        OR: [
          { message: { contains: "Watchdog", mode: "insensitive" } },
          { message: { contains: "buffering timeout", mode: "insensitive" } },
        ],
      },
      include: { device: { include: { agency: true } } },
      orderBy: { created_at: "desc" },
      take: 2000,
    }),
    prisma.systemConfig.findUnique({ where: { key: "LATEST_APK_VERSION" } }),
  ]);

  const latestVersion = latestVersionConfig?.value;
  const now = Date.now();
  const active: Incident[] = [];

  for (const device of devices) {
    if (!device.is_active || !device.installation_id || device.revoked_at) continue;
    const common = {
      deviceId: device.id,
      date: device.last_seen,
      agency: deviceLabel(device),
      city: device.agency.city || "Sin ciudad",
      tv: `TV ${device.tv_number || "?"}`,
      count: null,
      status: "active" as const,
    };
    const ageSeconds = (now - device.last_seen.getTime()) / 1000;
    const operationalState = getDeviceOperationalState(device, now);
    if (operationalState === "delayed") active.push({ ...common, key: `${device.id}-delayed`, type: "Contacto demorado", detail: elapsedDetail(ageSeconds) });
    if (operationalState === "offline") active.push({ ...common, key: `${device.id}-offline`, type: "Sin conexión", detail: elapsedDetail(ageSeconds) });
    if (device.playback_status === "error") active.push({ ...common, key: `${device.id}-playback`, type: "Error de reproducción", detail: "El reproductor informó un error" });
    if (device.free_space !== null && Number(device.free_space) < 2 * GB) active.push({ ...common, key: `${device.id}-storage`, type: "Poco almacenamiento", detail: `${(Number(device.free_space) / GB).toFixed(1)} GB libres` });
    if (latestVersion && device.app_version && device.app_version !== latestVersion) active.push({ ...common, key: `${device.id}-version`, type: "Versión desactualizada", detail: `${device.app_version} instalada · ${latestVersion} disponible` });
  }

  const grouped = new Map<string, Incident>();
  for (const log of recoveryLogs) {
    const type = recoveryType(log.message);
    const key = `${log.device_id}-${type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count = (existing.count || 0) + 1;
      continue;
    }
    grouped.set(key, {
      key,
      deviceId: log.device_id,
      date: log.created_at,
      agency: deviceLabel(log.device),
      city: log.device.agency.city || "Sin ciudad",
      tv: `TV ${log.device.tv_number || "?"}`,
      type,
      detail: log.message,
      count: 1,
      status: "recovered",
    });
  }
  const recovered = Array.from(grouped.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="p-5 pb-16 sm:p-8 lg:p-10">
      <AutoRefresh intervalMs={15000} />
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Centro de operaciones</p>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Alertas e incidentes</h1>
        <p className="mt-2 text-sm text-muted">Problemas activos y recuperaciones automáticas de los últimos 30 días.</p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary title="Alertas activas" value={active.length} detail="Requieren revisión" icon={<ShieldAlert />} tone={active.length ? "danger" : "green"} />
        <Summary title="Recuperaciones" value={recovered.reduce((sum, row) => sum + (row.count || 0), 0)} detail="Últimos 30 días" icon={<RefreshCw />} tone="blue" />
        <Summary title="TV afectadas" value={new Set(recovered.map(row => row.deviceId)).size} detail="Con recuperación automática" icon={<Tv />} tone="amber" />
      </section>

      <IncidentPanel title="Requieren atención" subtitle="Condiciones que continúan activas" icon={<AlertTriangle className="h-5 w-5 text-danger" />} rows={active} empty="No hay alertas activas. Todos los equipos vinculados están en condiciones normales." />
      <div className="h-6" />
      <IncidentPanel title="Recuperaciones automáticas" subtitle="Agrupadas por dispositivo y tipo durante los últimos 30 días" icon={<History className="h-5 w-5 text-primary" />} rows={recovered} empty="Todavía no se registraron recuperaciones automáticas." />
    </div>
  );
}

function Summary({ title, value, detail, icon, tone }: { title: string; value: number; detail: string; icon: React.ReactNode; tone: "danger" | "green" | "blue" | "amber" }) {
  const colors = { danger: "border-danger/30 bg-danger/[0.07] text-danger", green: "border-primary/30 bg-primary/[0.07] text-primary", blue: "border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-300", amber: "border-amber-400/30 bg-amber-400/[0.07] text-amber-300" }[tone];
  return <div className={`rounded-2xl border p-5 ${colors}`}><div className="mb-4 [&>svg]:h-6 [&>svg]:w-6">{icon}</div><p className="text-3xl font-black text-white">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</p><p className="mt-2 text-xs text-muted">{detail}</p></div>;
}

function IncidentPanel({ title, subtitle, icon, rows, empty }: { title: string; subtitle: string; icon: React.ReactNode; rows: Incident[]; empty: string }) {
  return <section className="glass overflow-hidden rounded-2xl border border-border shadow-xl">
    <div className="flex items-center gap-3 border-b border-border p-5"><div className="rounded-lg bg-primary/10 p-2">{icon}</div><div><h2 className="font-bold text-white">{title}</h2><p className="text-xs text-muted">{subtitle}</p></div></div>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left">
      <thead><tr className="border-b border-border bg-background/30 text-[11px] uppercase tracking-wider text-muted"><th className="px-5 py-3">Fecha</th><th>Agencia</th><th>Dispositivo</th><th>Tipo</th><th>Detalle</th><th className="text-center">Cantidad</th><th className="pr-5 text-right">Estado</th></tr></thead>
      <tbody className="divide-y divide-border/60">{rows.map(row => <tr key={row.key} className="text-sm hover:bg-primary/[0.03]">
        <td className="whitespace-nowrap px-5 py-4 text-muted">{formatDate(row.date)}</td>
        <td><p className="font-semibold text-white">{row.agency}</p><p className="text-xs text-muted">{row.city}</p></td>
        <td><Link href={`/monitoring/${row.deviceId}`} className="font-semibold text-primary hover:underline">{row.tv}</Link></td>
        <td className="font-medium text-white">{row.type}</td>
        <td className="max-w-xs truncate pr-3 text-xs text-muted" title={row.detail}>{row.detail}</td>
        <td className="text-center font-bold text-white">{row.count ?? "—"}</td>
        <td className="pr-5 text-right"><Status recovered={row.status === "recovered"} /></td>
      </tr>)}</tbody>
    </table></div> : <div className="m-5 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-5 text-center text-sm text-muted"><CheckCircle2 className="mr-2 h-5 w-5 text-primary" />{empty}</div>}
  </section>;
}

function Status({ recovered }: { recovered: boolean }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${recovered ? "border-primary/30 bg-primary/10 text-primary" : "border-danger/30 bg-danger/10 text-danger"}`}>{recovered ? "Recuperado" : "Activa"}</span>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function elapsedDetail(seconds: number) {
  if (seconds < 3600) return `Sin contacto hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Sin contacto hace ${Math.floor(seconds / 3600)} h`;
  return `Sin contacto hace ${Math.floor(seconds / 86400)} días`;
}
