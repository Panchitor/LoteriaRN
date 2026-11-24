import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Activity, HardDrive, Wifi, ArrowLeft, MonitorPlay, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getDeviceOperationalState, operationalStateLabel } from "@/lib/deviceStatus";
import { RemoteControls } from "./RemoteControls";
import { AVAILABILITY_WINDOWS, buildAvailabilityTimeline, calculateDeviceAvailability, calculateRecentOutages, formatAvailabilityDuration, formatAvailabilityPercent, type AvailabilityTimelineSegment } from "@/lib/deviceAvailability";
import { isRemoteCommandFresh } from "@/lib/remoteCommands";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const historyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [device, availabilityPeriods, appSessions, lastStartLog] = await Promise.all([
    prisma.device.findUnique({ where: { id }, include: { agency: true } }),
    prisma.deviceAvailabilityPeriod.findMany({
      where: { device_id: id, ended_at: { gte: historyStart } },
      orderBy: { ended_at: "desc" },
    }),
    prisma.deviceAppSession.findMany({ where: { device_id: id }, orderBy: { started_at: "desc" }, take: 20 }),
    prisma.deviceLog.findFirst({ where: { device_id: id, message: { startsWith: "TV iniciado" } }, orderBy: { created_at: "desc" } }),
  ]);

  if (!device) return notFound();

  const now = Date.now();
  const diffSec = (now - new Date(device.last_seen).getTime()) / 1000;
  const operationalState = getDeviceOperationalState(device, now);
  const availability = calculateDeviceAvailability(device, availabilityPeriods, now);
  const recentOutages = calculateRecentOutages(device, availabilityPeriods, now).slice(0, 10);
  const timelines = Object.fromEntries(AVAILABILITY_WINDOWS.map(window => [window.key, buildAvailabilityTimeline(device, availabilityPeriods, window.milliseconds, now)]));
  const isOnline = operationalState === "online";
  const commandFresh = isRemoteCommandFresh(device, now);
  const stateColor = operationalState === "online" ? "text-[#32d74b]" : operationalState === "delayed" ? "text-amber-300" : operationalState === "inactive" ? "text-slate-500" : "text-[#ff453a]";
  let downloadedFiles: string[] = [];
  let downloadedFilesInvalid = false;
  try {
    const parsed = device.downloaded_videos ? JSON.parse(device.downloaded_videos) : [];
    downloadedFiles = Array.isArray(parsed) ? parsed.filter((file): file is string => typeof file === "string") : [];
  } catch {
    downloadedFilesInvalid = true;
  }

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <AutoRefresh intervalMs={3000} />
      <div className="mb-6">
        <Link href="/monitoring" className="inline-flex items-center gap-2 text-muted hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver a Monitoreo
        </Link>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-4">
            <Activity className={stateColor} />
            Agencia {device.agency.number}
            {device.agency.name && <span className="text-muted text-2xl font-medium">/ {device.agency.name}</span>}
          </h1>
          <p className="text-muted mt-2 font-mono text-sm max-w-xl">Identificador de red: {device.id}</p>
          <p className={`mt-3 text-sm font-bold ${isOnline ? "text-primary" : "text-danger"}`}>
            Última señal recibida: {formatDateTime(device.last_seen)} · {formatElapsed(diffSec)}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-sm border flex items-center gap-2 font-bold uppercase tracking-widest ${isOnline ? "bg-[#163620] border-[#32d74b] text-[#32d74b]" : operationalState === "delayed" ? "bg-amber-950/40 border-amber-400 text-amber-300" : operationalState === "inactive" ? "bg-slate-900 border-slate-600 text-slate-500" : "bg-[#3d1616] border-[#ff453a] text-[#ff453a]"}`}>
          {isOnline ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {operationalStateLabel(operationalState)}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted">Historial de disponibilidad</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {AVAILABILITY_WINDOWS.map(window => {
            const metric = availability[window.key];
            return (
              <div key={window.key} className="rounded border border-[#374151] bg-[#181b1f] p-5 shadow-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Últimas {window.label}</p>
                <p className="mt-2 text-3xl font-black text-[#32d74b]">{formatAvailabilityPercent(metric.percent)}</p>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>Online: <span className="text-white">{formatAvailabilityDuration(metric.onlineMs)}</span></p>
                  <p>Sin conexión: <span className="text-white">{formatAvailabilityDuration(metric.downtimeMs)}</span></p>
                  <p>Cortes detectados: <span className="text-white">{metric.interruptions}</span></p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">El historial se calcula desde que el servidor comenzó a registrar esta información.</p>
        <div className="mt-5 rounded border border-[#374151] bg-[#181b1f] p-5 shadow-xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white">Línea de tiempo</h3>
              <p className="mt-1 text-xs text-muted">Cada tramo muestra cuándo el equipo informó normalmente y cuándo perdió conexión.</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted">
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#32d74b]" /> Activo</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#ff453a]" /> Caído</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-slate-600" /> Sin historial</span>
            </div>
          </div>
          <div className="space-y-5">
            {AVAILABILITY_WINDOWS.map(window => <AvailabilityTimeline key={window.key} label={window.label} windowMs={window.milliseconds} segments={timelines[window.key] || []} now={now} />)}
          </div>
        </div>
        <div className="mt-5 overflow-x-auto rounded border border-[#374151] bg-[#181b1f]">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-[#374151] text-xs uppercase tracking-wider text-muted"><th className="p-3">Inicio del corte</th><th>Restablecimiento</th><th>Duración</th></tr></thead>
            <tbody className="divide-y divide-[#374151]">
              {recentOutages.length ? recentOutages.map(outage => (
                <tr key={outage.startedAt.toISOString()}>
                  <td className="p-3 text-white">{formatDateTime(outage.startedAt)}</td>
                  <td className={outage.endedAt ? "text-white" : "font-bold text-[#ff453a]"}>{outage.endedAt ? formatDateTime(outage.endedAt) : "En curso"}</td>
                  <td className="text-muted">{formatAvailabilityDuration(outage.durationMs)}</td>
                </tr>
              )) : <tr><td colSpan={3} className="p-5 text-center text-muted">Todavía no se registraron cortes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Connection Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Telemetría
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Último contacto:</span>
               <span className="text-white font-mono">{formatDateTime(device.last_seen)}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Último inicio registrado:</span>
               <span className="text-white font-mono">{appSessions[0] ? formatDateTime(appSessions[0].started_at) : lastStartLog ? formatDateTime(lastStartLog.created_at) : "Sin datos"}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Latencia estimada (ping):</span>
               <span className={isOnline ? "text-[#32d74b] font-mono" : "text-[#ff453a] font-mono"}>
                 Hace {Math.floor(diffSec)} s
               </span>
            </div>
          </div>
        </div>

        {/* Hardware Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Hardware & Sistema
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Hardware ID:</span>
               <span className="text-white font-mono">{device.hw_id || 'No reportado'}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Version App:</span>
               <span className="text-white font-mono">{device.app_version || 'N/A'}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#374151] pb-2">
               <span className="text-muted">Android:</span>
               <span className="text-right text-white font-mono">{device.android_version || 'No reportado'}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#374151] pb-2">
               <span className="text-muted">Fabricante / Modelo:</span>
               <span className="text-right text-white font-mono">{device.device_model || 'No reportado'}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#374151] pb-2">
               <span className="text-muted">Serie informada por firmware:</span>
               <span className="max-w-[65%] break-all text-right text-white font-mono">{device.device_serial || 'No reportado'}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-4">
               <span className="text-muted">ID de etiqueta del equipo:</span>
               <span className="max-w-[65%] break-all text-right text-primary font-mono font-bold">{device.asset_label || 'Sin asignar'}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Almacenamiento Libre:</span>
               <span className="text-white font-mono">
                 {device.free_space ? `${(Number(device.free_space) / 1024 / 1024 / 1024).toFixed(2)} GB` : 'No reportado'}
               </span>
            </div>
          </div>
        </div>
        
        {/* Playback Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between md:col-span-2">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <MonitorPlay className="h-4 w-4" /> Estado de Reproducción
          </h3>
          
          <div className="flex flex-col md:flex-row items-stretch gap-6">
            <div className="flex-1 bg-black p-6 rounded border border-[#374151] flex items-center justify-center min-h-[150px]">
               {device.playback_status === 'error' ? (
                 <div className="flex flex-col items-center text-[#ff453a]">
                    <AlertTriangle className="h-12 w-12 mb-2" />
                    <span className="font-bold uppercase tracking-widest">Error en reproductor</span>
                 </div>
               ) : (
                 <div className="flex flex-col items-center text-[#32d74b]">
                    <MonitorPlay className="h-12 w-12 mb-2" />
                    <span className="font-bold uppercase tracking-widest">{device.playback_status === 'live' ? 'Vivo' : ['offline', 'playing'].includes(device.playback_status || '') ? 'Videos' : 'Sin datos'}</span>
                 </div>
               )}
            </div>

            <div className="flex-1 bg-[#181b1f] border border-[#374151] rounded p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[150px]">
              <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Archivos Descargados
              </h3>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {downloadedFilesInvalid ? (
                  <div className="text-muted text-sm text-center mt-4">Error leyendo archivos.</div>
                ) : downloadedFiles.length === 0 ? (
                  <div className="text-muted text-sm text-center mt-4">No hay archivos locales.</div>
                ) : downloadedFiles.map((file) => (
                  <div key={file} className="text-white text-sm font-mono bg-black px-3 py-2 border border-[#374151] rounded">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded border border-[#374151] bg-[#181b1f] shadow-xl">
        <div className="border-b border-[#374151] p-5">
          <h2 className="font-bold text-white">Sesiones de la aplicación</h2>
          <p className="mt-1 text-xs text-muted">Desde la APK 1.0.94 se registra cada apertura, su última notificación y cuándo fue reemplazada por una nueva sesión.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-[#374151] text-xs uppercase tracking-wider text-muted"><th className="p-3">Inicio</th><th>Última notificación</th><th>Duración informada</th><th>Versión</th><th>Estado</th></tr></thead>
            <tbody className="divide-y divide-[#374151]">
              {appSessions.length ? appSessions.map((session, index) => {
                const reporting = !session.ended_at && now - session.last_seen.getTime() < 180_000;
                const status = reporting ? "Activa" : session.ended_at ? "Reemplazada por otra sesión" : "Sin señal / posible cierre";
                return <tr key={session.id}>
                  <td className="p-3 text-white">{formatDateTime(session.started_at)}</td>
                  <td className="text-white">{formatDateTime(session.last_seen)}</td>
                  <td className="text-muted">{formatAvailabilityDuration(session.last_seen.getTime() - session.started_at.getTime())}</td>
                  <td className="text-muted">{session.app_version || "—"}</td>
                  <td className={reporting ? "font-bold text-primary" : index === 0 && !session.ended_at ? "font-bold text-danger" : "text-muted"}>{status}</td>
                </tr>;
              }) : <tr><td colSpan={5} className="p-5 text-center text-muted">El historial detallado comenzará cuando el equipo instale la APK 1.0.94.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl lg:col-span-2">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">Última captura remota</h3>
          {device.last_screenshot ? (
            <div>
              <Image src={`/api/screenshots/${device.id}?v=${device.screenshot_at?.getTime() || 0}`} alt={`Captura de Agencia ${device.agency.number}`} width={1280} height={720} unoptimized className="w-full h-auto rounded border border-[#374151] bg-black object-contain" />
              <p className="mt-3 text-xs text-muted">Capturada: {device.screenshot_at?.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
            </div>
          ) : <div className="grid min-h-52 place-items-center rounded border border-dashed border-[#374151] text-sm text-muted">Todavía no hay capturas de este dispositivo.</div>}
        </div>
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">Control remoto</h3>
          <RemoteControls deviceId={device.id} isOnline={isOnline} screenshotPending={device.screenshot_requested && commandFresh && device.last_command === "screenshot"} restartPending={device.restart_requested && commandFresh && device.last_command === "restart"} screenshotUnsupported={Boolean(device.last_command_status?.includes("Android 8 o superior"))} />
          <div className="mt-6 border-t border-[#374151] pt-4 text-xs text-muted">
            <p>Última orden: <span className="text-white">{device.last_command === "screenshot" ? "Captura" : device.last_command === "restart" ? "Reinicio" : "—"}</span></p>
            <p className="mt-2">Resultado: <span className={device.last_command_status === "success" || device.last_command_status === "accepted" ? "text-primary" : device.last_command_status?.startsWith("error") ? "text-danger" : "text-amber-300"}>{friendlyCommandStatus(device.last_command_status)}</span></p>
            <p className="mt-2">Fecha: <span className="text-white">{device.last_command_at ? formatDateTime(device.last_command_at) : "—"}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailabilityTimeline({ label, windowMs, segments, now }: { label: string; windowMs: number; segments: AvailabilityTimelineSegment[]; now: number }) {
  const colors = { online: "bg-[#32d74b]", offline: "bg-[#ff453a]", untracked: "bg-slate-600" } as const;
  const descriptions = { online: "Activo", offline: "Caído", untracked: "Sin historial" } as const;
  return <div>
    <div className="mb-2 flex items-end justify-between gap-4">
      <span className="text-xs font-bold uppercase tracking-wider text-white">{label}</span>
      <span className="text-[11px] text-muted">{formatShortDate(new Date(now - windowMs))} → Ahora</span>
    </div>
    <div className="flex h-8 w-full overflow-hidden rounded border border-[#374151] bg-black" aria-label={`Disponibilidad de las últimas ${label}`}>
      {segments.map((segment, index) => {
        const width = Math.max(0.08, (segment.durationMs / windowMs) * 100);
        const title = `${descriptions[segment.status]}: ${formatDateTime(segment.startedAt)} a ${formatDateTime(segment.endedAt)} (${formatAvailabilityDuration(segment.durationMs)})`;
        return <span key={`${segment.status}-${segment.startedAt.getTime()}-${index}`} className={`${colors[segment.status]} h-full border-r border-black/20 transition-opacity hover:opacity-75`} style={{ width: `${width}%` }} title={title} />;
      })}
    </div>
    <div className="mt-1 flex justify-between text-[10px] text-muted"><span>Inicio</span><span>Ahora</span></div>
  </div>;
}

function friendlyCommandStatus(status: string | null) {
  if (!status) return "—";
  if (status === "success") return "Completada";
  if (status === "accepted") return "Aceptado por el dispositivo";
  if (status === "pending") return "Pendiente";
  if (status === "expired") return "Vencida: el equipo no respondió";
  if (status.includes("Android 8 o superior")) return "Captura no compatible con este TV Box";
  return status.replace(/^error:\s*/i, "Error: ");
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `hace ${Math.max(0, Math.floor(seconds))} segundos`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} horas`;
  return `hace ${Math.floor(seconds / 86400)} días`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
