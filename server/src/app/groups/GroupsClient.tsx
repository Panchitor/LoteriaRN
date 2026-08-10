"use client";

import { useState } from "react";
import { createGroup, deleteGroup, assignDeviceToGroup } from "./actions";
import { Plus, Trash2, Monitor, Info } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";

type Group = {
  id: string;
  name: string;
  color: string;
  _count: { devices: number };
};

type Device = {
  id: string;
  name?: string | null;
  agency_id: string;
  group_id: string | null;
  agency: { name: string | null, number: number };
};

export default function GroupsClient({ initialGroups, initialDevices }: { initialGroups: Group[], initialDevices: Device[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      await createGroup(name, color);
      setName("");
      setColor("#10b981");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de eliminar este grupo? Las pantallas perderán su asignación.")) {
      await deleteGroup(id);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <AutoRefresh intervalMs={3000} />
      
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-background glass border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Crear Grupo</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Nombre</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary transition-colors"
                placeholder="Ej: Vidrieras, Interior..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Color Identificador</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-12 h-12 rounded bg-transparent border-0 p-0 cursor-pointer"
                />
                <span className="text-muted text-sm">{color}</span>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              Crear Grupo
            </button>
          </form>
        </div>

        <div className="bg-background glass border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Grupos Existentes</h2>
          <div className="space-y-3">
            {initialGroups.length === 0 ? (
              <p className="text-muted text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> No hay grupos creados
              </p>
            ) : (
              initialGroups.map(group => (
                <div key={group.id} className="flex items-center justify-between bg-background/50 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: group.color }}></div>
                    <div>
                      <p className="text-white font-medium text-sm">{group.name}</p>
                      <p className="text-muted text-xs">{group._count.devices} pantallas</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(group.id)}
                    className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    title="Eliminar grupo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-background glass border border-border rounded-xl p-6 h-full">
          <h2 className="text-xl font-bold text-white mb-4">Asignación de Pantallas</h2>
          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {initialDevices.map(device => {
              const deviceName = `Pantalla TV - Agencia #${device.agency.number}`;
              const agencyName = device.agency.name || `Agencia ${device.agency.number}`;
              return (
                <div key={device.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-background p-3 rounded-lg">
                      <Monitor className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{deviceName}</h3>
                      <p className="text-sm text-muted">{agencyName}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <select
                      value={device.group_id || ""}
                      onChange={(e) => assignDeviceToGroup(device.id, e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary transition-colors text-sm"
                    >
                      <option value="">-- Sin grupo asignado --</option>
                      {initialGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
