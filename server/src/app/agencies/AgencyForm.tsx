"use client";

import { useState } from "react";
import { createAgency, deleteAgency, generateDeviceActivationCode, setDeviceActive, unlinkDevice } from "./actions";
import { Trash2, Plus, X, Link2Off, KeyRound, Power } from "lucide-react";

export function AgencyForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activation, setActivation] = useState<{ code: string; expiresAt: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await createAgency(formData);
    setLoading(false);
    
    if (res?.error) {
      setError(res.error);
    } else if (res?.activationCode && res.expiresAt) {
      setActivation({ code: res.activationCode, expiresAt: res.expiresAt });
    }
  }

  return (
    <>
      <button
        onClick={() => { setActivation(null); setError(null); setIsOpen(true); }}
        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors border border-primary/50 shadow-lg shadow-primary/20"
      >
        <Plus className="h-5 w-5" />
        Agregar Agencia
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">{activation ? "Código de vinculación" : "Nueva Agencia"}</h2>
            
            {activation ? (
              <div className="space-y-5 text-center">
                <p className="text-muted">Ingresá este código en el TV Box. Se puede usar una sola vez.</p>
                <div className="text-4xl font-black tracking-[0.25em] text-primary bg-surface-hover border border-primary/30 rounded-xl p-5">
                  {activation.code}
                </div>
                <p className="text-sm text-muted">Vence: {new Date(activation.expiresAt).toLocaleString("es-AR")}</p>
                <button type="button" onClick={() => setIsOpen(false)} className="w-full px-4 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary-hover">Cerrar</button>
              </div>
            ) : <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Número de agencia *</label>
                <input
                  type="number"
                  name="number"
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej: 1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Número de subagencia (opcional)</label>
                <input
                  type="number"
                  min="1"
                  name="subagency_number"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej: 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Número de TV *</label>
                <input type="number" min="1" name="tv_number" required className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white" placeholder="Ej: 1" />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Ciudad *</label>
                <input type="text" name="city" required className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white" placeholder="Ej: Viedma" />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Vencimiento del código *</label>
                <select name="activation_duration" defaultValue="20d" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white">
                  <option value="30m">30 minutos</option>
                  <option value="1d">1 día</option>
                  <option value="3d">3 días</option>
                  <option value="7d">1 semana</option>
                  <option value="20d">20 días (distribución)</option>
                  <option value="30d">1 mes</option>
                </select>
              </div>

              {error && <p className="text-danger border border-danger/20 bg-danger/10 p-2 rounded-lg text-sm">{error}</p>}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-muted hover:text-white bg-surface-hover transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>}
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        if(confirm("¿Seguro que deseas eliminar esta agencia? Los TVs asociadas quedarán huérfanas.")) {
          setLoading(true);
          await deleteAgency(id);
        }
      }}
      disabled={loading}
      className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
      title="Eliminar Agencia"
    >
      <Trash2 className="h-5 w-5" />
    </button>
  );
}

export function DeviceActions({ id, isLinked, isActive }: { id: string; isLinked: boolean; isActive: boolean }) {
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState("20d");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          const action = isActive ? "marcar como inactivo" : "reactivar";
          if (!confirm(`¿Querés ${action} este TV?`)) return;
          setLoading(true);
          await setDeviceActive(id, !isActive);
          setLoading(false);
        }}
        className={`text-xs px-2 py-1 rounded border ${isActive ? "border-amber-400/30 text-amber-300 hover:bg-amber-400/10" : "border-primary/30 text-primary hover:bg-primary/10"}`}
      >
        <Power className="inline h-3 w-3 mr-1" />{isActive ? "Desactivar" : "Reactivar"}
      </button>
      {isLinked && (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (!confirm("¿Desvincular este TV? La pantalla volverá a pedir un código.")) return;
            setLoading(true);
            await unlinkDevice(id);
            setLoading(false);
          }}
          className="text-xs px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10"
        >
          <Link2Off className="inline h-3 w-3 mr-1" />Desvincular
        </button>
      )}
      <select value={duration} onChange={e => setDuration(e.target.value)} className="text-xs bg-background border border-border rounded px-2 py-1 text-white">
        <option value="30m">30 min</option><option value="1d">1 día</option><option value="3d">3 días</option>
        <option value="7d">1 semana</option><option value="20d">20 días</option><option value="30d">1 mes</option>
      </select>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          const result = await generateDeviceActivationCode(id, duration);
          setLoading(false);
          if (result.activationCode) setGeneratedCode(result.activationCode);
        }}
        className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10"
      >
        <KeyRound className="inline h-3 w-3 mr-1" />Generar código
      </button>
      {generatedCode && <span className="font-mono font-bold tracking-widest text-primary">{generatedCode}</span>}
    </div>
  );
}
