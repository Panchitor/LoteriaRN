import { getStats } from "./actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BarChart3, PlayCircle, Clock } from "lucide-react";

export default async function StatsPage() {
  const stats = await getStats();

  const maxVideoCount = Math.max(...stats.topVideos.map(v => v.count), 1);
  const maxTimelineCount = Math.max(...stats.timeline.map(t => t.count), 1);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <AutoRefresh intervalMs={3000} />

      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Estadísticas de Reproducción
        </h1>
        <p className="text-muted mt-2">Métricas y análisis del contenido reproducido en las agencias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass bg-background p-6 rounded-xl border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg text-primary">
              <PlayCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted">Reproducciones Completadas</p>
              <p className="text-3xl font-bold text-white">{stats.totalPlaybacks}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Videos */}
        <div className="glass bg-background p-6 rounded-xl border border-border">
          <h2 className="text-xl font-bold text-white mb-6">Videos Más Reproducidos</h2>
          <div className="space-y-4">
            {stats.topVideos.length === 0 ? (
              <p className="text-muted text-center py-8">No hay datos disponibles</p>
            ) : (
              stats.topVideos.map((video, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white truncate pr-4">{video.filename}</span>
                    <span className="text-muted font-mono">{video.count}</span>
                  </div>
                  <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(video.count / maxVideoCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="glass bg-background p-6 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Línea de Tiempo (Últimas 24h)</h2>
            <Clock className="h-5 w-5 text-muted" />
          </div>
          
          <div className="h-64 flex items-end gap-2 mt-8">
            {stats.timeline.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative flex-1 flex flex-col justify-end">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-background border border-border px-2 py-1 rounded text-xs text-white whitespace-nowrap transition-opacity z-10">
                    {item.count} reproducciones
                  </div>
                  {/* Bar */}
                  <div 
                    className="w-full bg-blue-500/50 hover:bg-blue-400 rounded-t-sm transition-all duration-300 min-h-[4px]"
                    style={{ height: `${Math.max((item.count / maxTimelineCount) * 100, 2)}%` }}
                  />
                </div>
                {/* Time Label - show every 3 hours to avoid crowding */}
                <span className="text-[10px] text-muted transform -rotate-45 -translate-x-1 mt-2">
                  {idx % 3 === 0 ? item.time : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
