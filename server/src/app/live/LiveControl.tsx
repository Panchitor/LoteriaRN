"use client";

import { useState } from "react";
import { toggleLive } from "./actions";
import { Activity, Power, Video, Clock } from "lucide-react";

export function LiveControl({ initialLive }: { initialLive: any }) {
  const [isActive, setIsActive] = useState(initialLive.is_active);
  const [url, setUrl] = useState(initialLive.url || "");
  const [pollInterval, setPollInterval] = useState(initialLive.pollInterval || 10);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const newState = !isActive;
    await toggleLive(newState, url, pollInterval);
    setIsActive(newState);
    setLoading(false);
  }

  async function handleSaveUrl() {
    setLoading(true);
    await toggleLive(isActive, url, pollInterval);
    setLoading(false);
    alert("Configuración guardada exitosamente");
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Control Panel */}
      <div className="glass rounded-2xl p-8 border border-border shadow-xl">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-border">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors ${isActive ? 'bg-primary shadow-primary/40' : 'bg-surface-hover shadow-black/50'}`}>
            <Activity className={`h-8 w-8 ${isActive ? 'text-white' : 'text-muted'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Estado Global</h2>
            <p className="text-muted mt-1">{isActive ? 'Transmitiendo en vivo' : 'En espera (Offline)'}</p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
            isActive 
              ? 'bg-danger hover:bg-red-600 text-white shadow-lg shadow-danger/20 border border-danger/50' 
              : 'bg-primary hover:bg-emerald-500 text-white shadow-lg shadow-primary/20 border border-primary/50'
          }`}
        >
          <Power className="h-6 w-6" />
          {loading ? 'Procesando...' : isActive ? 'DETENER TRANSMISIÓN (Forzado)' : 'INICIAR EN VIVO (Forzado)'}
        </button>
        
        <p className="text-sm text-muted text-center mt-4">
          <span className="font-bold text-white">Automático:</span> El sistema revisa la señal cada {pollInterval}s. Si querés forzar el cambio inmediato, usá este botón.
        </p>
      </div>

      {/* Config Panel */}
      <div className="glass rounded-2xl p-8 border border-border mt-8 md:mt-0 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Video className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold text-white">Configuración del Stream</h3>
          </div>
          
          <div className="mb-4">
            <label className="text-sm text-muted mb-2 block">URL del servidor Flussonic (M3U8):</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors font-mono text-sm"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm text-muted mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Frecuencia de auto-detección:
            </label>
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value={5}>5 segundos (Rápido)</option>
              <option value={10}>10 segundos (Normal)</option>
              <option value={15}>15 segundos</option>
              <option value={20}>20 segundos</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={handleSaveUrl}
          disabled={loading}
          className="w-full py-3 rounded-lg font-medium text-white bg-surface-hover hover:bg-background border border-border hover:border-primary transition-colors mt-4"
        >
          Guardar Configuración
        </button>
      </div>
    </div>
  );
}
