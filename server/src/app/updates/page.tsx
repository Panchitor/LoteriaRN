"use client";

import { useState, useEffect } from "react";
import { Upload, Download, Smartphone, Loader2, CheckCircle, Trash2, Calendar, HardDrive } from "lucide-react";

interface ApkVersion {
  filename: string;
  version: string;
  sizeBytes: number;
  createdAt: string;
}

export default function UpdatesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [history, setHistory] = useState<ApkVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/admin/updates");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !version) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("apk", file);
    formData.append("version", version);

    try {
      const res = await fetch("/api/admin/updates", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: '¡Actualización publicada con éxito! Los televisores la detectarán pronto.' });
        setFile(null);
        setVersion("");
        fetchHistory(); // Refresh history
      } else {
        setMessage({ type: 'error', text: data.error || 'Ocurrió un error.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de red.' });
    }
    
    setLoading(false);
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la versión ${filename}?`)) return;

    try {
      const res = await fetch("/api/admin/updates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });

      if (res.ok) {
        fetchHistory(); // Refresh history
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
      }
    } catch (e) {
      alert("Error de red");
    }
  };

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Download className="h-8 w-8 text-primary" />
          Actualizaciones OTA
        </h1>
        <p className="text-muted mt-2">
          Sube un nuevo archivo `.apk` de la aplicación de TV. Los televisores detectarán la versión automáticamente y la instalarán.
        </p>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg border font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-danger/10 border-danger/20 text-danger'}`}>
          {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="glass rounded-2xl border border-border p-6 shadow-xl mb-10">
        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-muted mb-2 block">Número de Versión</label>
            <input 
              type="text" 
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Ejemplo: 1.0.2"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted/50"
            />
            <p className="text-xs text-muted/60 mt-2">Debe ser superior a la versión actual de las TVs para que la instalen.</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted mb-2 block">Archivo APK</label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors bg-background/50">
              <input 
                type="file" 
                accept=".apk"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden" 
                id="apk-upload" 
              />
              <label htmlFor="apk-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full ${file ? 'bg-primary/20 text-primary' : 'bg-background text-muted'}`}>
                  <Smartphone className="w-8 h-8" />
                </div>
                {file ? (
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-xs text-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white font-medium">Haz clic para seleccionar el APK</p>
                    <p className="text-xs text-muted">Solo archivos .apk de Android</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !file || !version}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-4 rounded-lg font-bold transition-colors border border-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            {loading ? "Subiendo APK al Servidor..." : "Publicar Actualización OTA"}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-6">Historial de Versiones</h2>
        {loadingHistory ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center border border-border rounded-xl bg-background/50 text-muted">
            No hay versiones subidas todavía.
          </div>
        ) : (
          <div className="grid gap-4">
            {history.map((apk, i) => (
              <div key={i} className="flex items-center justify-between p-4 glass rounded-xl border border-border">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <span className="font-bold text-white text-lg">v{apk.version}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(apk.createdAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      {(apk.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(apk.filename)}
                  className="p-3 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  title="Eliminar versión"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
