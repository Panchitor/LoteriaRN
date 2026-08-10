"use client";

import { useState } from "react";
import { toggleEmergency } from "./actions";
import { AlertTriangle, Power } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";

export function EmergencyClient({ initialState }: { initialState: { isActive: boolean, message: string } }) {
  const [isActive, setIsActive] = useState(initialState.isActive);
  const [message, setMessage] = useState(initialState.message);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingState, setPendingState] = useState(false);

  const handleToggle = () => {
    const newState = !isActive;
    setPendingState(newState);
    setShowConfirm(true);
  };

  const confirmToggle = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      await toggleEmergency(pendingState, message);
      setIsActive(pendingState);
    } catch (e) {
      console.error(e);
      alert("Error al actualizar estado de emergencia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass bg-background p-8 rounded-2xl border border-border relative overflow-hidden">
      <AutoRefresh intervalMs={3000} />
      
      {/* Background glow effect based on state */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000 ${isActive ? 'bg-danger' : 'bg-primary'}`} />

      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between relative z-10">
        
        <div className="flex-1 w-full">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-xl ${isActive ? 'bg-danger/20 text-danger shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-primary/20 text-primary shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}>
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {isActive ? 'Emergencia ACTIVADA' : 'Estado NORMAL'}
              </h2>
              <p className={`text-sm ${isActive ? 'text-danger/80 font-medium' : 'text-primary/80 font-medium'}`}>
                {isActive ? 'Las pantallas están mostrando la alerta' : 'Las pantallas operan con normalidad'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-muted mb-2">Mensaje de Emergencia</label>
            <textarea
              className="w-full bg-background border border-border rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none disabled:opacity-50"
              rows={3}
              placeholder="Ej: Evacuar el edificio inmediatamente..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading || isActive}
            />
            {isActive && <p className="text-xs text-muted mt-2">Desactiva la emergencia para cambiar el mensaje.</p>}
          </div>
        </div>

        <div className="flex-shrink-0 w-full md:w-auto flex flex-col items-center">
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`
              relative group flex flex-col items-center justify-center
              h-40 w-40 rounded-full border-4 transition-all duration-300
              ${isActive 
                ? 'border-danger/30 bg-danger/10 hover:bg-danger/20 hover:border-danger/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' 
                : 'border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <Power className={`h-12 w-12 mb-2 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-danger' : 'text-primary'}`} />
            <span className={`font-bold tracking-wider ${isActive ? 'text-danger' : 'text-primary'}`}>
              {isActive ? 'DESACTIVAR' : 'ACTIVAR'}
            </span>
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-background glass p-8 rounded-2xl max-w-md w-full border border-border shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">
              {pendingState ? '¿Activar Alerta de Emergencia?' : '¿Desactivar Alerta?'}
            </h3>
            <p className="text-muted mb-6">
              {pendingState 
                ? 'Esto interrumpirá la reproducción normal en todas las pantallas y mostrará el mensaje de emergencia.' 
                : 'Las pantallas volverán a su programación normal.'}
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg font-medium text-muted hover:text-white hover:bg-surface-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggle}
                className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
                  pendingState ? 'bg-danger hover:bg-danger/80' : 'bg-primary hover:bg-primary/80'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
