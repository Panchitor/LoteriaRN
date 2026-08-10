"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileVideo, Trash2, RefreshCw, Image as ImageIcon, GripVertical, Play } from "lucide-react";
import { deleteVideo, reorderVideos } from "./actions";

export function VideoUpload() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayDuration, setDisplayDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = file?.type?.startsWith('image/') || false;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (isImage) {
      formData.append("display_duration", displayDuration.toString());
    }

    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de subida");
      }

      setIsOpen(false);
      setFile(null);
      router.refresh();
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors border border-primary/50 shadow-lg shadow-primary/20"
      >
        <Upload className="h-5 w-5" />
        Subir Contenido
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
            <h2 className="text-xl font-bold text-white mb-6">Subir Contenido</h2>
            
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="video/mp4,image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="video-upload"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                  {isImage ? (
                    <ImageIcon className="h-12 w-12 mb-3 text-purple-400" />
                  ) : (
                    <FileVideo className={`h-12 w-12 mb-3 ${file ? 'text-primary' : 'text-muted'}`} />
                  )}
                  {file ? (
                    <p className="text-white font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-white font-medium">Click para seleccionar archivo</p>
                      <p className="text-sm text-muted mt-1">Videos (.mp4) o Imágenes (.jpg, .png, .webp)</p>
                    </>
                  )}
                </label>
              </div>

              {isImage && (
                <div className="bg-surface-hover/50 rounded-xl p-4 border border-border">
                  <label className="block text-sm text-muted mb-2">
                    Duración en pantalla (segundos):
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={displayDuration}
                    onChange={(e) => setDisplayDuration(parseInt(e.target.value) || 10)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white"
                  />
                </div>
              )}

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
                  disabled={loading || !file}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {loading ? "Subiendo..." : "Subir e Insertar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteVideoButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        if(confirm("¿Eliminar este contenido? Se borrará del disco y se actualizará el Manifest automáticamente.")) {
          setLoading(true);
          await deleteVideo(id);
        }
      }}
      disabled={loading}
      className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
    >
      <Trash2 className="h-5 w-5" />
    </button>
  );
}

interface SortableVideo {
  id: string;
  original_name: string;
  media_type: string;
  size_bytes: bigint;
  hash_md5: string;
  created_at: Date;
  filename: string;
  display_duration: number;
}

export function ReorderableTable({ videos }: { videos: SortableVideo[] }) {
  const [items, setItems] = useState(videos);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const newItems = [...items];
    const dragged = newItems.splice(draggedIdx, 1)[0];
    newItems.splice(idx, 0, dragged);
    setItems(newItems);
    setDraggedIdx(idx);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const ids = items.map(v => v.id);
    await reorderVideos(ids);
    setSaving(false);
    setHasChanges(false);
    window.location.reload();
  };

  return (
    <>
      {hasChanges && (
        <div className="px-6 py-3 bg-primary/10 border-b border-primary/30 flex items-center justify-between">
          <span className="text-sm text-primary font-medium">Orden modificado — Guardar para aplicar cambios</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving && <RefreshCw className="h-3 w-3 animate-spin" />}
            {saving ? "Guardando..." : "Guardar Orden"}
          </button>
        </div>
      )}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-hover/30 border-b border-border">
            <th className="px-3 py-4 text-xs font-semibold text-muted uppercase tracking-wider w-10"></th>
            <th className="px-3 py-4 text-xs font-semibold text-muted uppercase tracking-wider w-10">#</th>
            <th className="px-3 py-4 text-xs font-semibold text-muted uppercase tracking-wider w-16">Tipo</th>
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Archivo</th>
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Tamaño</th>
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Hash (MD5)</th>
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-muted">
                No hay contenido en la playlist.
              </td>
            </tr>
          ) : (
            items.map((video, index) => (
              <tr
                key={video.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={() => setDraggedIdx(null)}
                className={`hover:bg-surface-hover/30 transition-colors cursor-grab active:cursor-grabbing ${
                  draggedIdx === index ? 'opacity-50 bg-primary/10' : ''
                }`}
              >
                <td className="px-3 py-4 text-muted">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-3 py-4 text-muted font-mono">{index + 1}</td>
                <td className="px-3 py-4">
                  {video.media_type === 'image' ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                      <ImageIcon className="h-3 w-3" /> {video.display_duration}s
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                      <FileVideo className="h-3 w-3" /> Video
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-white">{video.original_name}</td>
                <td className="px-6 py-4 text-sm text-muted">
                  {(Number(video.size_bytes) / (1024 * 1024)).toFixed(1)} MB
                </td>
                <td className="px-6 py-4 text-xs font-mono text-muted/60">{video.hash_md5.substring(0,16)}...</td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(video.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                  <a
                    href={`/api/videos/${video.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Reproducir/Ver"
                  >
                    <Play className="h-5 w-5" />
                  </a>
                  <DeleteVideoButton id={video.id} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
