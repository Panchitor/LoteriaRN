import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Activity, HardDrive, Wifi, ArrowLeft, MonitorPlay, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const device = await prisma.device.findUnique({
    where: { id },
    include: { agency: true }
  });

  if (!device) return notFound();

  const now = Date.now();
  const diffSec = (now - new Date(device.last_seen).getTime()) / 1000;
  const isOnline = diffSec < 30;

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <AutoRefresh intervalMs={3000} />
      <div className="mb-6">
        <Link href="/monitoring" className="inline-flex items-center gap-2 text-muted hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver a Monitoreo
        </Link>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-4">
            <Activity className={isOnline ? "text-[#32d74b]" : "text-[#ff453a]"} />
            Agencia {device.agency.number}
            {device.agency.name && <span className="text-muted text-2xl font-medium">/ {device.agency.name}</span>}
          </h1>
          <p className="text-muted mt-2 font-mono text-sm max-w-xl">
             Identificador de red: {device.id}
          </p>
        </div>
        
        <div className={`px-4 py-2 rounded-sm border flex items-center gap-2 font-bold uppercase tracking-widest ${
          isOnline 
             ? "bg-[#163620] border-[#32d74b] text-[#32d74b]" 
             : "bg-[#3d1616] border-[#ff453a] text-[#ff453a]"
        }`}>
          {isOnline ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {isOnline ? "OPERATIVO" : "SIN CONEXIÓN"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Connection Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Telemetría
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Último contacto:</span>
               <span className="text-white font-mono">{new Date(device.last_seen).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Latencia estimada (ping):</span>
               <span className={isOnline ? "text-[#32d74b] font-mono" : "text-[#ff453a] font-mono"}>
                 Hace {Math.floor(diffSec)} s
               </span>
            </div>
          </div>
        </div>

        {/* Hardware Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Hardware & Sistema
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Hardware ID:</span>
               <span className="text-white font-mono">{device.hw_id || 'No reportado'}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Version App:</span>
               <span className="text-white font-mono">{device.app_version || 'N/A'}</span>
            </div>
            <div className="flex justify-between border-b border-[#374151] pb-2">
               <span className="text-muted">Almacenamiento Libre:</span>
               <span className="text-white font-mono">
                 {device.free_space ? `${(Number(device.free_space) / 1024 / 1024 / 1024).toFixed(2)} GB` : 'No reportado'}
               </span>
            </div>
          </div>
        </div>
        
        {/* Playback Widget */}
        <div className="bg-[#181b1f] border border-[#374151] p-6 shadow-xl relative overflow-hidden flex flex-col justify-between md:col-span-2">
          <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <MonitorPlay className="h-4 w-4" /> Estado de Reproducción
          </h3>
          
          <div className="flex flex-col md:flex-row items-stretch gap-6">
            <div className="flex-1 bg-black p-6 rounded border border-[#374151] flex items-center justify-center min-h-[150px]">
               {device.playback_status === 'error' ? (
                 <div className="flex flex-col items-center text-[#ff453a]">
                    <AlertTriangle className="h-12 w-12 mb-2" />
                    <span className="font-bold uppercase tracking-widest">Error en reproductor</span>
                 </div>
               ) : (
                 <div className="flex flex-col items-center text-[#32d74b]">
                    <MonitorPlay className="h-12 w-12 mb-2" />
                    <span className="font-bold uppercase tracking-widest">{device.playback_status || 'DESCONOCIDO'}</span>
                 </div>
               )}
            </div>

            <div className="flex-1 bg-[#181b1f] border border-[#374151] rounded p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[150px]">
              <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Archivos Descargados
              </h3>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {(() => {
                  try {
                    const files = device.downloaded_videos ? JSON.parse(device.downloaded_videos) : [];
                    if (!files || files.length === 0) {
                      return <div className="text-muted text-sm text-center mt-4">No hay archivos locales.</div>;
                    }
                    return files.map((f: string, i: number) => (
                      <div key={i} className="text-white text-sm font-mono bg-black px-3 py-2 border border-[#374151] rounded">
                        {f}
                      </div>
                    ));
                  } catch (e) {
                    return <div className="text-muted text-sm text-center mt-4">Error leyendo archivos.</div>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
