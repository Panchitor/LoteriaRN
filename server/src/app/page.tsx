import { Activity, Tv, AlertTriangle, MonitorPlay, Film, Server, Database, Play, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const devices = await prisma.device.findMany({ include: { agency: true }, orderBy: { last_seen: 'desc' } });
  const videos = await prisma.video.findMany({ orderBy: { order: 'asc' } });
  const liveEvent = await prisma.liveEvent.findFirst();

  const now = Date.now();
  
  const processedDevices = devices.map(d => {
    const diffSec = (now - new Date(d.last_seen).getTime()) / 1000;
    return { ...d, isOnline: diffSec < 30, diffSec };
  });

  const onlineCount = processedDevices.filter(d => d.isOnline).length;
  const offlineCount = processedDevices.filter(d => !d.isOnline).length;
  const errorCount = processedDevices.filter(d => d.playback_status === 'error').length;
  const isLive = liveEvent?.is_active || false;

  const latestDisconnects = processedDevices.filter(d => !d.isOnline).slice(0, 5);
  
  const totalVideoSizeMB = videos.reduce((acc, v) => acc + (Number(v.size_bytes) / (1024 * 1024)), 0).toFixed(1);

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)]">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard General</h1>
          <p className="text-muted mt-2">Métricas globales y estado interconectado en tiempo real.</p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Sistema Operativo
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          title="Terminales Red"
          value={devices.length.toString()}
          subValue={`${offlineCount} offline / ${onlineCount} online`}
          icon={<Tv className="h-6 w-6 text-blue-400" />}
          trend={offlineCount > 0 ? "down" : "up"}
        />
        <MetricCard
          title="Estado Emisión"
          value={isLive ? "EN VIVO" : "LOOP VIDEOS"}
          subValue={isLive ? "Transmitiendo señal" : "Reproducción local"}
          icon={<Activity className="h-6 w-6 text-emerald-400" />}
          trend={isLive ? "up" : "neutral"}
        />
        <MetricCard
          title="Medios Almacenados"
          value={videos.length.toString()}
          subValue={`Archivos de cartelería (${totalVideoSizeMB} MB)`}
          icon={<MonitorPlay className="h-6 w-6 text-purple-400" />}
          trend="up"
        />
        <MetricCard
          title="Alertas Terminales"
          value={errorCount.toString()}
          subValue={errorCount > 0 ? "Revisar panel" : "Todo en orden"}
          icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
          trend={errorCount > 0 ? "down" : "up"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel - Lista de Videos */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-border shadow-xl flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              Contenido en Pantalla
            </h3>
            {isLive ? (
              <span className="px-3 py-1 rounded-full bg-danger/20 text-danger text-xs font-bold border border-danger/30 flex items-center gap-2 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-danger"></div>
                TRANSMISIÓN EN VIVO
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30 flex items-center gap-2">
                <Play className="h-3 w-3" />
                LOOP DE VIDEOS
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {videos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted">
                <Film className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay videos cargados.</p>
              </div>
            ) : (
              videos.map((v, i) => (
                <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-hover/30 border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-muted font-bold shadow-inner flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate text-sm">{v.original_name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Database className="h-3 w-3" /> {(Number(v.size_bytes) / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <span className="text-xs text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Procesado
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Side Panel - Desconexiones y Estado de Hardware */}
        <div className="glass rounded-2xl p-6 border border-border shadow-xl overflow-hidden flex flex-col h-[500px]">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-400" />
            Salud de Terminales
          </h3>
          
          {/* Gráfico simple de terminales */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-muted mb-2">
              <span>Online ({onlineCount})</span>
              <span>Offline ({offlineCount})</span>
            </div>
            <div className="h-3 w-full bg-surface-hover rounded-full overflow-hidden flex">
              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(onlineCount / (devices.length || 1)) * 100}%` }}></div>
              <div className="h-full bg-danger transition-all duration-1000" style={{ width: `${(offlineCount / (devices.length || 1)) * 100}%` }}></div>
            </div>
          </div>

          <h4 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Desconexiones Recientes</h4>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {latestDisconnects.length === 0 ? (
               <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-surface-hover/20">
                 <CheckCircle2 className="h-6 w-6 text-primary/50 mb-2" />
                 <p className="text-muted text-sm text-center">Agencias estables.</p>
               </div>
            ) : (
               latestDisconnects.map(d => (
                 <DisconnectItem 
                    key={d.id} 
                    agency={`Agencia ${d.agency.number}`} 
                    time={`Hace ${Math.floor(d.diffSec / 60)} min`} 
                 />
               ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subValue, icon, trend }: any) {
  return (
    <div className="glass rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden group hover:border-muted/30 transition-all duration-300">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-500">
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium text-muted mb-1">{title}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        <div className="mt-4 flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              trend === "up" ? "bg-primary" : trend === "down" ? "bg-danger" : "bg-muted"
            }`}
          />
          <p className="text-xs text-muted/80">{subValue}</p>
        </div>
      </div>
    </div>
  );
}

function DisconnectItem({ agency, time }: { agency: string; time: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-hover/50 border border-transparent hover:border-border transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
          <Tv className="h-4 w-4 text-danger" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{agency}</p>
          <p className="text-xs text-muted">{time}</p>
        </div>
      </div>
      <span className="text-[10px] uppercase px-2 py-1 rounded bg-danger/10 text-danger font-bold border border-danger/20">
        Offline
      </span>
    </div>
  );
}
