"use client";

import { useState } from "react";
import { saveConfigs } from "./actions";
import { Save, Loader2, Building2, CalendarClock } from "lucide-react";

type Config = {
  key: string;
  value: string;
};

export function SettingsClient({ initialConfigs }: { initialConfigs: Config[] }) {
  const defaults: Config[] = [
    { key: 'FLUSSONIC_BASE_URL', value: '' },
    { key: 'FLUSSONIC_POLL_INTERVAL', value: '5' },
    { key: 'PRIMARY_API_URL', value: 'https://loteriarn.patagonialive.media' },
    { key: 'SECONDARY_API_URL', value: '' },
    { key: 'EDITOR_SHOW_AGENCIES', value: 'true' },
    { key: 'EDITOR_SHOW_SCHEDULE', value: 'false' },
  ];
  const [configs, setConfigs] = useState<Config[]>(
    defaults.map(item => initialConfigs.find(config => config.key === item.key) || item)
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleUpdate = (index: number, val: string) => {
    const newConfigs = [...configs];
    newConfigs[index].value = val;
    setConfigs(newConfigs);
  };

  const labels: Record<string, string> = {
    FLUSSONIC_BASE_URL: 'URL de transmisión en vivo',
    FLUSSONIC_POLL_INTERVAL: 'Comprobación del vivo (segundos)',
    PRIMARY_API_URL: 'Servidor principal',
    SECONDARY_API_URL: 'Servidor de respaldo (futuro)',
  };
  const textConfigs = configs.filter(config => !config.key.startsWith('EDITOR_SHOW_'));
  const editorFeatureConfigs = configs.filter(config => config.key.startsWith('EDITOR_SHOW_'));

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    const validConfigs = configs.filter(c => c.key.trim() !== "");
    
    const res = await saveConfigs(validConfigs);
    
    if (res.success) {
      setMessage({ type: 'success', text: 'Configuraciones guardadas correctamente.' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Ocurrió un error.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border font-medium ${message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-danger/10 border-danger/20 text-danger'}`}>
          {message.text}
        </div>
      )}

      <section>
        <h2 className="text-lg font-bold text-white">Opciones visibles para editores</h2>
        <p className="mt-1 text-sm text-muted">El administrador siempre conserva acceso a todas las secciones.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {editorFeatureConfigs.map(config => {
            const enabled = config.value === 'true';
            const isAgencies = config.key === 'EDITOR_SHOW_AGENCIES';
            const Icon = isAgencies ? Building2 : CalendarClock;
            return (
              <button
                type="button"
                key={config.key}
                onClick={() => handleUpdate(configs.findIndex(item => item.key === config.key), enabled ? 'false' : 'true')}
                className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${enabled ? 'border-primary/40 bg-primary/10' : 'border-border bg-background'}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`rounded-lg p-2 ${enabled ? 'bg-primary/20 text-primary' : 'bg-surface text-muted'}`}><Icon className="h-5 w-5" /></span>
                  <span><strong className="block text-white">{isAgencies ? 'Agencias y TVs' : 'Horarios y Programación'}</strong><small className="text-muted">Visible en el menú del editor</small></span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>{enabled ? 'ACTIVO' : 'OCULTO'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-3 border-t border-border pt-6">
        {textConfigs.map((config) => {
          const index = configs.findIndex(item => item.key === config.key);
          return (
          <div key={config.key} className="flex gap-4 items-start">
            <div className="flex-1">
              <label className="text-sm font-semibold text-white mb-1 block">{labels[config.key]}</label>
              <input 
                type="text"
                placeholder="Valor de la configuración..."
                value={config.value}
                onChange={(e) => handleUpdate(index, e.target.value)}
                className="w-full bg-background hover:bg-surface-hover focus:bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
              />
            </div>
          </div>
          );
        })}
        {configs.length === 0 && (
          <div className="text-center py-6 text-muted border border-dashed border-border rounded-lg">
            No hay configuraciones almacenadas. Agrega tu primera variable.
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center pt-6 border-t border-border gap-4">
        <p className="text-xs text-muted">Las versiones APK, hashes y emergencia se gestionan desde sus pantallas específicas.</p>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg font-medium transition-colors border border-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
