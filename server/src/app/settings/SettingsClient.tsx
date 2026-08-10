"use client";

import { useState } from "react";
import { saveConfigs, deleteConfig } from "./actions";
import { Save, Plus, Trash2, Loader2 } from "lucide-react";

type Config = {
  key: string;
  value: string;
};

export function SettingsClient({ initialConfigs }: { initialConfigs: Config[] }) {
  const [configs, setConfigs] = useState<Config[]>(
    initialConfigs.length > 0 ? initialConfigs : [{ key: "FLUSSONIC_BASE_URL", value: "" }]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleAddPreset = (key: string, defaultValue: string) => {
    if (!configs.find(c => c.key === key)) {
      setConfigs([...configs, { key, value: defaultValue }]);
    }
  };

  const handleAdd = () => {
    setConfigs([...configs, { key: "", value: "" }]);
  };

  const handleUpdate = (index: number, field: 'key' | 'value', val: string) => {
    const newConfigs = [...configs];
    newConfigs[index][field] = val;
    setConfigs(newConfigs);
  };

  const handleRemove = async (index: number) => {
    const conf = configs[index];
    if (conf.key && initialConfigs.find(c => c.key === conf.key)) {
      setLoading(true);
      const res = await deleteConfig(conf.key);
      if (res.success) {
        setConfigs(configs.filter((_, i) => i !== index));
        setMessage({ type: 'success', text: 'Variable eliminada correctamente.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Error al eliminar.' });
      }
      setLoading(false);
    } else {
      setConfigs(configs.filter((_, i) => i !== index));
    }
  };

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

      <div className="space-y-3">
        {configs.map((config, index) => (
          <div key={index} className="flex gap-4 items-start">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Clave</label>
              <input 
                type="text"
                placeholder="Ej. HEARTBEAT_INTERVAL"
                value={config.key}
                onChange={(e) => handleUpdate(index, 'key', e.target.value.toUpperCase())}
                className="w-full bg-background hover:bg-surface-hover focus:bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
              />
            </div>
            <div className="flex-[2]">
              <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Valor</label>
              <input 
                type="text"
                placeholder="Valor de la configuración..."
                value={config.value}
                onChange={(e) => handleUpdate(index, 'value', e.target.value)}
                className="w-full bg-background hover:bg-surface-hover focus:bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
              />
            </div>
            <div className="pt-6">
              <button 
                onClick={() => handleRemove(index)}
                className="p-2.5 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white border border-danger/20 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && (
          <div className="text-center py-6 text-muted border border-dashed border-border rounded-lg">
            No hay configuraciones almacenadas. Agrega tu primera variable.
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center pt-6 border-t border-border gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 text-muted hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-hover border border-border"
          >
            <Plus className="w-4 h-4" /> Agregar Variable
          </button>

          {!configs.find(c => c.key === "PRIMARY_API_URL") && (
            <button
              onClick={() => handleAddPreset("PRIMARY_API_URL", "https://loteriarn.patagonialive.media")}
              className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 px-3 py-2 rounded-lg transition-colors"
            >
              + URL Servidor Primario
            </button>
          )}

          {!configs.find(c => c.key === "SECONDARY_API_URL") && (
            <button
              onClick={() => handleAddPreset("SECONDARY_API_URL", "https://backup.patagonialive.media")}
              className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors"
            >
              + URL Servidor Secundario (Fallback)
            </button>
          )}
        </div>

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
