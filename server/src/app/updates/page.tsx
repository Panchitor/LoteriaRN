"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FlaskConical, Loader2, Rocket, ShieldCheck, Smartphone, Trash2, Upload, XCircle } from "lucide-react";

type Device = { id: string; tv_number: number | null; app_version: string | null; update_channel: string; last_seen: string; device_model: string | null; agency: { number: number; subagency_number: number | null; city: string | null } };
type Apk = { filename: string; version: string; sizeBytes: number; createdAt: string };
type Data = { history: Apk[]; devices: Device[]; config: Record<string, string> };

export default function UpdatesPage() {
  const [data, setData] = useState<Data>({ history: [], devices: [], config: {} });
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/updates', { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const pilotDevices = useMemo(() => data.devices.filter(d => d.update_channel === 'PILOT'), [data.devices]);
  const pilotVersion = data.config.PILOT_APK_VERSION || '';
  const stableVersion = data.config.LATEST_APK_VERSION || '—';

  async function uploadPilot(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !version) return;
    setBusy(true); setMessage('');
    const body = new FormData(); body.append('apk', file); body.append('version', version); body.append('channel', 'PILOT');
    const response = await fetch('/api/admin/updates', { method: 'POST', body });
    const result = await response.json();
    setMessage(response.ok ? `APK ${version} publicada en PRUEBA. Todavía no se envió a ningún equipo.` : result.error);
    if (response.ok) { setFile(null); setVersion(''); await load(); }
    setBusy(false);
  }

  async function action(payload: object, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setMessage('');
    const response = await fetch('/api/admin/updates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    setMessage(response.ok ? 'Operación realizada correctamente.' : result.error);
    if (response.ok) { setSelected([]); await load(); }
    setBusy(false);
  }

  async function remove(filename: string) {
    if (!confirm(`¿Eliminar ${filename}?`)) return;
    const response = await fetch('/api/admin/updates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }) });
    const result = await response.json();
    setMessage(response.ok ? 'APK eliminada.' : result.error);
    if (response.ok) await load();
  }

  return <div className="p-6 sm:p-10 max-w-6xl mx-auto w-full space-y-8">
    <header>
      <h1 className="text-3xl font-extrabold text-white flex items-center gap-3"><Download className="text-primary" /> Actualizaciones APK</h1>
      <p className="text-muted mt-2">Probá una APK en equipos seleccionados antes de publicarla de forma masiva.</p>
    </header>

    {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-white">{message}</div>}

    <section className="grid md:grid-cols-2 gap-5">
      <div className="glass border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="text-primary" /><div><p className="text-xs uppercase text-muted">Canal estable</p><p className="text-2xl font-bold text-white">v{stableVersion}</p></div></div>
        <p className="text-sm text-muted mt-4">La reciben todos los equipos que no estén seleccionados para pruebas.</p>
      </div>
      <div className="glass border border-amber-400/30 rounded-2xl p-6">
        <div className="flex items-center gap-3"><FlaskConical className="text-amber-300" /><div><p className="text-xs uppercase text-muted">Canal de prueba</p><p className="text-2xl font-bold text-white">{pilotVersion ? `v${pilotVersion}` : 'Sin APK'}</p></div></div>
        <p className="text-sm text-muted mt-4">{pilotDevices.length} equipo(s) habilitado(s) para probar.</p>
      </div>
    </section>

    <section className="glass border border-border rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-1">1. Subir APK de prueba</h2>
      <p className="text-sm text-muted mb-5">Subirla no actualiza ningún TV Box hasta que lo selecciones abajo.</p>
      <form onSubmit={uploadPilot} className="grid md:grid-cols-[180px_1fr_auto] gap-3 items-end">
        <label className="text-sm text-muted">Versión<input required value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.76" className="mt-2 w-full bg-background border border-border rounded-lg px-3 py-3 text-white" /></label>
        <label className="text-sm text-muted">Archivo APK<input required type="file" accept=".apk" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-2 block w-full bg-background border border-border rounded-lg px-3 py-2 text-white" /></label>
        <button disabled={busy || !file || !version} className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg px-5 py-3 disabled:opacity-50 flex gap-2"><Upload /> Subir a prueba</button>
      </form>
    </section>

    <section className="glass border border-border rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white">2. Elegir dispositivos piloto</h2>
      <p className="text-sm text-muted mt-1 mb-5">Al habilitarlos recibirán la APK piloto en el próximo contacto. Podés devolverlos al canal estable.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-border"><th className="p-3"></th><th>Dispositivo</th><th>Ciudad</th><th>Versión actual</th><th>Canal</th><th>Último contacto</th></tr></thead><tbody>
        {data.devices.map(d => <tr key={d.id} className="border-b border-border/60 text-white">
          <td className="p-3"><input type="checkbox" checked={selected.includes(d.id)} onChange={e => setSelected(s => e.target.checked ? [...s, d.id] : s.filter(id => id !== d.id))} /></td>
          <td className="font-semibold">Ag. {d.agency.number}{d.agency.subagency_number ? ` / Sub. ${d.agency.subagency_number}` : ''} · TV {d.tv_number || '—'}<span className="block text-xs text-muted font-normal">{d.device_model || 'Modelo sin informar'}</span></td>
          <td>{d.agency.city || 'Sin ciudad'}</td><td>{d.app_version || '—'}</td>
          <td><span className={`rounded-full px-2 py-1 text-xs font-bold ${d.update_channel === 'PILOT' ? 'bg-amber-400/15 text-amber-300' : 'bg-primary/15 text-primary'}`}>{d.update_channel === 'PILOT' ? 'PRUEBA' : 'ESTABLE'}</span></td>
          <td>{new Date(d.last_seen).toLocaleString()}</td>
        </tr>)}
      </tbody></table></div>
      <div className="flex flex-wrap gap-3 mt-5">
        <button disabled={busy || !pilotVersion || selected.length === 0} onClick={() => action({ action: 'assign', channel: 'PILOT', deviceIds: selected }, `¿Enviar la APK piloto v${pilotVersion} a ${selected.length} dispositivo(s)?`)} className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg disabled:opacity-40 flex gap-2"><FlaskConical /> Habilitar prueba</button>
        <button disabled={busy || selected.length === 0} onClick={() => action({ action: 'assign', channel: 'STABLE', deviceIds: selected })} className="border border-primary text-primary font-bold px-4 py-2 rounded-lg disabled:opacity-40">Volver a estable</button>
      </div>
    </section>

    <section className="glass border border-border rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white">3. Finalizar prueba</h2>
      <div className="flex flex-wrap gap-3 mt-4">
        <button disabled={busy || !pilotVersion} onClick={() => action({ action: 'promote' }, `¿Publicar v${pilotVersion} para TODOS los dispositivos? Esta acción inicia la distribución masiva.`)} className="bg-primary text-black font-bold px-5 py-3 rounded-lg disabled:opacity-40 flex gap-2"><Rocket /> Aprobar y publicar masivamente</button>
        <button disabled={busy || !pilotVersion} onClick={() => action({ action: 'cancel' }, '¿Cancelar la prueba y devolver todos los equipos al canal estable?')} className="border border-danger text-danger font-bold px-5 py-3 rounded-lg disabled:opacity-40 flex gap-2"><XCircle /> Cancelar prueba</button>
      </div>
    </section>

    <section><h2 className="text-xl font-bold text-white mb-4">Archivos disponibles</h2><div className="grid gap-3">
      {data.history.map(apk => <div key={apk.filename} className="glass border border-border rounded-xl p-4 flex items-center justify-between"><div className="flex gap-3 items-center"><Smartphone className="text-primary" /><div><p className="font-bold text-white">v{apk.version}</p><p className="text-xs text-muted">{(apk.sizeBytes / 1048576).toFixed(1)} MB · {new Date(apk.createdAt).toLocaleString()}</p></div></div><button onClick={() => remove(apk.filename)} className="text-danger p-2" title="Eliminar"><Trash2 /></button></div>)}
    </div></section>
    {busy && <div className="fixed inset-0 bg-black/40 grid place-items-center"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>}
  </div>;
}
