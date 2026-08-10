"use client";

import { useState } from "react";
import { createAgency, deleteAgency } from "./actions";
import { Trash2, Plus, X } from "lucide-react";

export function AgencyForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await createAgency(formData);
    setLoading(false);
    
    if (res?.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
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
            <h2 className="text-xl font-bold text-white mb-6">Nueva Agencia</h2>
            
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Número de Sucursal *</label>
                <input
                  type="number"
                  name="number"
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej: 1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Nombre / Zona (Opcional)</label>
                <input
                  type="text"
                  name="name"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej: Centro Viedma"
                />
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
            </form>
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
