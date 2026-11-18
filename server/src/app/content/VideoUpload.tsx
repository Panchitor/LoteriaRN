"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, FileVideo, Trash2, RefreshCw, Image as ImageIcon, GripVertical, Play, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { deleteVideo, reorderVideos, updateImageDuration } from "./actions";

export function VideoUpload() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<Array<{ file: File; progress: number; status: 'waiting' | 'uploading' | 'done' | 'error'; error?: string }>>([]);
  const [displayDuration, setDisplayDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(file => /\.(mp4|jpe?g|png|webp)$/i.test(file.name));
    setFiles(current => [...current, ...accepted.map(file => ({ file, progress: 0, status: 'waiting' as const }))]);
  };

  const uploadOne = (item: typeof files[number], index: number) => new Promise<boolean>((resolve) => {
    const formData = new FormData();
    formData.append("file", item.file);
    if (item.file.type.startsWith('image/')) formData.append("display_duration", displayDuration.toString());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/videos");
    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      setFiles(current => current.map((entry, i) => i === index ? { ...entry, progress: Math.round(event.loaded * 100 / event.total), status: 'uploading' } : entry));
    };
    xhr.onload = () => {
      let message = "Error de subida";
      try { message = JSON.parse(xhr.responseText)?.error || message; } catch {}
      setFiles(current => current.map((entry, i) => i === index ? (xhr.status >= 200 && xhr.status < 300
        ? { ...entry, progress: 100, status: 'done' }
        : { ...entry, status: 'error', error: message }) : entry));
      resolve(xhr.status >= 200 && xhr.status < 300);
    };
    xhr.onerror = () => {
      setFiles(current => current.map((entry, i) => i === index ? { ...entry, status: 'error', error: 'Error de conexión' } : entry));
      resolve(false);
    };
    xhr.send(formData);
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      let failed = 0;
      for (let index = 0; index < files.length; index++) {
        if (files[index].status !== 'done' && !(await uploadOne(files[index], index))) failed++;
      }
      router.refresh();
      if (failed === 0) setTimeout(() => { setIsOpen(false); setFiles([]); }, 700);
      else setError(`${failed} archivo(s) no pudieron subirse. Podés reintentarlos.`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error de subida");
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
          <div className="bg-background border border-border rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Subir Contenido</h2>
            
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              >
                <input
                  type="file"
                  multiple
                  accept="video/mp4,image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="video-upload"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
                <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="h-12 w-12 mb-3 text-primary" />
                  <p className="text-white font-medium">Arrastrá archivos aquí o hacé clic para seleccionarlos</p>
                  <p className="text-sm text-muted mt-1">Podés elegir varios MP4, JPG, PNG o WebP</p>
                </label>
              </div>

              {files.some(item => item.file.type.startsWith('image/')) && (
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

              {files.length > 0 && <div className="space-y-2 max-h-52 overflow-y-auto">
                {files.map((item, index) => <div key={`${item.file.name}-${index}`} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    {item.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-primary" /> : item.status === 'error' ? <AlertCircle className="h-4 w-4 text-danger" /> : <FileVideo className="h-4 w-4 text-muted" />}
                    <span className="text-white truncate flex-1">{item.file.name}</span>
                    <span className="text-xs text-muted">{item.status === 'waiting' ? 'Esperando' : `${item.progress}%`}</span>
                    {!loading && <button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X className="h-4 w-4 text-muted" /></button>}
                  </div>
                  <div className="h-1 bg-black/30 rounded mt-2"><div className={`h-1 rounded ${item.status === 'error' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${item.progress}%` }} /></div>
                  {item.error && <div className="text-xs text-danger mt-1">{item.error}</div>}
                </div>)}
              </div>}

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
                  disabled={loading || files.length === 0}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {loading ? "Subiendo cola..." : `Subir ${files.length || ''} archivo${files.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function StandbyUpload({ configured, initialRevision }: { configured: boolean; initialRevision: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(initialRevision);

  const upload = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    const data = new FormData();
    data.append('file', file);
    try {
      const response = await fetch('/api/standby', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
      setMessage('Imagen de espera guardada.');
      setRevision(Date.now());
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  return <div className="glass rounded-2xl border border-border p-5 mb-8 flex flex-col md:flex-row items-center gap-5">
    <div className="w-44 h-24 bg-black rounded-lg border border-border overflow-hidden flex items-center justify-center">
      {configured ? <Image key={revision} src={`/api/standby?v=${revision}`} alt="Pantalla de espera" width={176} height={96} unoptimized className="w-full h-full object-contain" /> : <span className="text-xs text-muted text-center px-2">Imagen institucional predeterminada</span>}
    </div>
    <div className="flex-1">
      <h2 className="font-bold text-white">Pantalla de espera</h2>
      <p className="text-sm text-muted mt-1">Se muestra cuando no hay contenido o mientras el primer archivo se descarga.</p>
      {message && <p className="text-sm text-primary mt-2">{message}</p>}
    </div>
    <label className="cursor-pointer px-4 py-2 rounded-lg bg-surface-hover border border-border text-white hover:border-primary">
      {loading ? 'Guardando…' : configured ? 'Reemplazar imagen' : 'Subir imagen'}
      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} onChange={e => upload(e.target.files?.[0])} />
    </label>
  </div>;
}

export function DeleteVideoButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        if(confirm("¿Eliminar este contenido? Se borrará del disco y se actualizará el Manifest automáticamente.")) {
          setLoading(true);
          const result = await deleteVideo(id);
          if (result?.error) alert(result.error);
          router.refresh();
        }
      }}
      disabled={loading}
      className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
    >
      <Trash2 className="h-5 w-5" />
    </button>
  );
}

function ImageDurationEditor({ id, initialDuration }: { id: string; initialDuration: number }) {
  const [duration, setDuration] = useState(initialDuration);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="inline-flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
      <input
        type="number"
        min={3}
        max={3600}
        value={duration}
        onChange={e => { setDuration(Number(e.target.value)); setSaved(false); }}
        className="w-20 bg-background border border-border rounded px-2 py-1 text-xs text-white"
        aria-label="Duración de la imagen en segundos"
      />
      <span className="text-xs text-muted">seg</span>
      <button
        type="button"
        disabled={saving || duration === initialDuration}
        onClick={async () => {
          setSaving(true);
          const result = await updateImageDuration(id, duration);
          setSaving(false);
          if (result.success) setSaved(true);
        }}
        className="p-1.5 text-primary hover:bg-primary/10 rounded disabled:opacity-40"
        title="Guardar duración"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </button>
      {saved && <span className="text-xs text-primary">Guardado</span>}
    </div>
  );
}

interface SortableVideo {
  id: string;
  original_name: string;
  media_type: string;
  size_bytes: bigint;
  hash_md5: string;
  hash_sha256: string | null;
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
            <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Integridad</th>
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
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                        <ImageIcon className="h-3 w-3" /> Imagen
                      </span>
                      <ImageDurationEditor id={video.id} initialDuration={video.display_duration} />
                    </div>
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
                <td className="px-6 py-4 text-xs font-mono text-muted/60">{(video.hash_sha256 || video.hash_md5).substring(0,16)}...</td>
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
