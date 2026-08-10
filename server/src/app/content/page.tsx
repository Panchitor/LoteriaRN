import { prisma } from "@/lib/prisma";
import { VideoUpload, ReorderableTable } from "./VideoUpload";
import { PlaySquare, Database, HardDrive, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const videos = await prisma.video.findMany({
    orderBy: [{ order: "asc" }, { created_at: "asc" }],
  });

  const versionHash = videos.reduce((acc, v) => acc + v.created_at.getTime(), videos.length);
  const manifestDisplay = videos.length > 0
    ? new Date(videos[videos.length - 1].created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Ninguna';

  const totalBytes = videos.reduce((acc, curr) => acc + Number(curr.size_bytes), 0);
  const gbUsed = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const videoCount = videos.filter(v => v.media_type === 'video').length;
  const imageCount = videos.filter(v => v.media_type === 'image').length;

  // Serialize for client component
  const serializedVideos = videos.map(v => ({
    ...v,
    size_bytes: v.size_bytes,
    created_at: v.created_at,
  }));

  return (
    <div className="p-8 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-7xl mx-auto w-full">
      <AutoRefresh intervalMs={3000} />
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestor de Contenido</h1>
          <p className="text-muted mt-2">Subida de institucionales y sincronización de Manifest para los TVs.</p>
        </div>
        <VideoUpload />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass rounded-xl p-5 flex items-center gap-4 border border-border">
          <div className="bg-primary/20 p-3 rounded-lg"><PlaySquare className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-sm text-muted">Videos</p>
            <p className="text-2xl font-bold text-white">{videoCount}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4 border border-border">
          <div className="bg-purple-500/20 p-3 rounded-lg"><ImageIcon className="h-6 w-6 text-purple-500" /></div>
          <div>
            <p className="text-sm text-muted">Imágenes</p>
            <p className="text-2xl font-bold text-white">{imageCount}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4 border border-border">
          <div className="bg-amber-500/20 p-3 rounded-lg"><HardDrive className="h-6 w-6 text-amber-500" /></div>
          <div>
            <p className="text-sm text-muted">Alojamiento</p>
            <p className="text-2xl font-bold text-white">{gbUsed} GB</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4 border border-border">
          <div className="bg-blue-500/20 p-3 rounded-lg"><Database className="h-6 w-6 text-blue-500" /></div>
          <div>
            <p className="text-sm text-muted">Manifest</p>
            <p className="text-2xl font-bold text-white">{manifestDisplay}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-border overflow-hidden">
        <div className="bg-surface-hover/80 px-6 py-4 border-b border-border flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-white">Orden de Reproducción (arrastrá para reordenar)</h2>
        </div>
        <ReorderableTable videos={serializedVideos} />
      </div>
    </div>
  );
}
