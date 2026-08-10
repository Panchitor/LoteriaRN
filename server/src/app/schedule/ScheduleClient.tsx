"use client";

import { useState } from "react";
import { createSchedule, toggleSchedule, deleteSchedule } from "./actions";
import { Plus, Trash2, Calendar, Clock, Video, Layers } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";

type Schedule = {
  id: string;
  name: string;
  video_ids: string;
  days: string;
  start_time: string;
  end_time: string;
  priority: number;
  is_active: boolean;
  group_id: string | null;
  group: { name: string, color: string } | null;
};

type Video = {
  id: string;
  original_name: string;
  media_type: string;
};

type Group = {
  id: string;
  name: string;
  color: string;
};

const DAYS_OF_WEEK = [
  { id: "mon", label: "Lun" },
  { id: "tue", label: "Mar" },
  { id: "wed", label: "Mié" },
  { id: "thu", label: "Jue" },
  { id: "fri", label: "Vie" },
  { id: "sat", label: "Sáb" },
  { id: "sun", label: "Dom" },
];

export default function ScheduleClient({ initialSchedules, videos, groups }: { initialSchedules: Schedule[], videos: Video[], groups: Group[] }) {
  const [name, setName] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [priority, setPriority] = useState(0);
  const [groupId, setGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions, option => option.value);
    setSelectedVideos(options);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || selectedVideos.length === 0 || selectedDays.length === 0 || !startTime || !endTime) {
      alert("Por favor, completa los campos requeridos.");
      return;
    }

    setLoading(true);
    try {
      await createSchedule({
        name,
        video_ids: JSON.stringify(selectedVideos),
        days: JSON.stringify(selectedDays),
        start_time: startTime,
        end_time: endTime,
        priority: Number(priority),
        group_id: groupId === "" ? null : groupId
      });
      // reset form
      setName("");
      setSelectedVideos([]);
      setPriority(0);
    } finally {
      setLoading(false);
    }
  };

  const getDayLabels = (daysJson: string) => {
    try {
      const days = JSON.parse(daysJson) as string[];
      if (days.length === 7) return "Todos los días";
      const sortedDays = DAYS_OF_WEEK.filter(d => days.includes(d.id)).map(d => d.label);
      return sortedDays.join(", ");
    } catch {
      return "Días inválidos";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <AutoRefresh intervalMs={3000} />
      
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-background glass border border-border rounded-xl p-6 sticky top-24">
          <h2 className="text-xl font-bold text-white mb-4">Nueva Programación</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Nombre descriptivo</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                placeholder="Ej: Sorteo Navidad Matutino"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Contenido (Ctrl+click para varios)</label>
              <select 
                multiple
                value={selectedVideos}
                onChange={handleVideoSelect}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary min-h-[120px]"
                required
              >
                {videos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.original_name} ({v.media_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">Días de la semana</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedDays.includes(day.id) 
                        ? "bg-primary text-white" 
                        : "bg-background border border-border text-muted hover:text-white hover:border-primary/50"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Hora Inicio</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Hora Fin</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Prioridad</label>
                <input 
                  type="number" 
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Grupo (Opcional)</label>
                <select 
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                >
                  <option value="">Todas las pantallas</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg transition-colors mt-2 disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              Crear Programación
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {initialSchedules.length === 0 ? (
          <div className="bg-background glass border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <Calendar className="h-16 w-16 text-muted/50 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No hay programaciones</h3>
            <p className="text-muted max-w-md">
              Crea reglas para determinar qué contenido se reproduce en ciertos horarios, días y grupos de pantallas.
            </p>
          </div>
        ) : (
          initialSchedules.map(schedule => (
            <div key={schedule.id} className={`bg-background glass border ${schedule.is_active ? 'border-primary/30' : 'border-border/50 opacity-70'} rounded-xl p-5 transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {schedule.name}
                    {!schedule.is_active && <span className="text-xs bg-danger/20 text-danger px-2 py-0.5 rounded">Inactivo</span>}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> {schedule.start_time} - {schedule.end_time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> {getDayLabels(schedule.days)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleSchedule(schedule.id, !schedule.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${schedule.is_active ? 'bg-background border border-border text-white hover:border-danger hover:text-danger' : 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-white'}`}
                  >
                    {schedule.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button 
                    onClick={() => { if(confirm('¿Eliminar esta programación?')) deleteSchedule(schedule.id); }}
                    className="p-1.5 text-muted hover:text-danger bg-background border border-border hover:border-danger/50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div>
                  <span className="text-xs text-muted font-medium mb-1 flex items-center gap-1"><Video className="w-3.5 h-3.5"/> Contenido ({JSON.parse(schedule.video_ids).length})</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {/* Just showing count for simplicity, could map names if needed */}
                    <span className="text-xs text-white bg-background px-2 py-1 rounded border border-border">
                      {JSON.parse(schedule.video_ids).length} elemento(s)
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted font-medium mb-1 flex items-center gap-1"><Layers className="w-3.5 h-3.5"/> Grupo Asignado</span>
                  <div className="mt-1">
                    {schedule.group ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-white bg-background px-2 py-1 rounded border border-border">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: schedule.group.color }}></span>
                        {schedule.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted italic">Todas las pantallas</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
