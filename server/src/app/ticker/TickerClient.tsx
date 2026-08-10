"use client";

import { useState } from "react";
import { createTicker, toggleTicker, deleteTicker } from "./actions";
import { Trash2, Plus, Type, Power, PowerOff } from "lucide-react";
import { useFormStatus } from "react-dom";

type Ticker = {
  id: string;
  text: string;
  is_active: boolean;
  speed: number;
  position: string;
  bg_color: string;
  text_color: string;
  created_at: Date;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {pending ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <><Plus className="w-5 h-5" /> Agregar Marquesina</>
      )}
    </button>
  );
}

export function TickerClient({ tickers }: { tickers: Ticker[] }) {
  const [previewText, setPreviewText] = useState("Texto de prueba de marquesina...");
  const [previewSpeed, setPreviewSpeed] = useState(50);
  const [previewPosition, setPreviewPosition] = useState("bottom");
  const [previewBgColor, setPreviewBgColor] = useState("#000000");
  const [previewBgOpacity, setPreviewBgOpacity] = useState("CC");
  const [previewTextColor, setPreviewTextColor] = useState("#FFFFFF");

  const fullBgColor = `${previewBgColor}${previewBgOpacity}`;

  const getAnimationDuration = (speed: number) => {
    // 50 is normal, 20 is fast, 100 is slow (lower speed number = faster animation)
    // Actually standard marquee: 50 pixels per second or something. Let's map it.
    // Let's say speed 20 is slow, 50 is normal, 80 is fast.
    if (speed <= 30) return "20s";
    if (speed <= 60) return "10s";
    return "5s";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="glass rounded-2xl border border-border p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Type className="w-5 h-5 text-primary" />
            Nueva Marquesina
          </h2>

          <form action={createTicker} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Texto</label>
              <textarea
                name="text"
                required
                className="w-full bg-surface-hover border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors min-h-[100px]"
                placeholder="Ingrese el texto a mostrar..."
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Velocidad</label>
                <select 
                  name="speed" 
                  className="w-full bg-surface-hover border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                  value={previewSpeed}
                  onChange={(e) => setPreviewSpeed(Number(e.target.value))}
                >
                  <option value={30}>Lenta</option>
                  <option value={50}>Normal</option>
                  <option value={80}>Rápida</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Posición</label>
                <select 
                  name="position" 
                  className="w-full bg-surface-hover border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                  value={previewPosition}
                  onChange={(e) => setPreviewPosition(e.target.value)}
                >
                  <option value="bottom">Inferior</option>
                  <option value="top">Superior</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Color Fondo</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-12 w-12 rounded bg-transparent border-0 cursor-pointer"
                    value={previewBgColor}
                    onChange={(e) => setPreviewBgColor(e.target.value)}
                  />
                  <select 
                    className="flex-1 bg-surface-hover border border-border rounded-lg px-2 text-white text-sm"
                    value={previewBgOpacity}
                    onChange={(e) => setPreviewBgOpacity(e.target.value)}
                  >
                    <option value="FF">100%</option>
                    <option value="CC">80%</option>
                    <option value="99">60%</option>
                    <option value="66">40%</option>
                  </select>
                </div>
                <input type="hidden" name="bg_color" value={fullBgColor} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Color Texto</label>
                <input
                  type="color"
                  name="text_color"
                  className="h-12 w-full rounded bg-transparent border-0 cursor-pointer"
                  value={previewTextColor}
                  onChange={(e) => setPreviewTextColor(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <SubmitButton />
            </div>
          </form>
        </div>

        <div className="glass rounded-2xl border border-border p-6">
          <h3 className="text-sm font-bold text-muted mb-4 uppercase tracking-wider">Vista Previa</h3>
          <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden border border-border/50">
            {/* Mock TV Screen */}
            <div className="absolute inset-0 flex items-center justify-center text-muted/20">
              Contenido TV
            </div>
            {/* Marquee Preview */}
            <div 
              className={`absolute w-full h-12 flex items-center overflow-hidden z-10 ${previewPosition === 'top' ? 'top-0' : 'bottom-0'}`}
              style={{ backgroundColor: fullBgColor }}
            >
              <div 
                className="whitespace-nowrap inline-block px-4 animate-[marquee_linear_infinite]"
                style={{ 
                  color: previewTextColor, 
                  animationDuration: getAnimationDuration(previewSpeed) 
                }}
              >
                <span className="text-xl font-bold">{previewText}</span>
              </div>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes marquee {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
          `}} />
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="glass rounded-2xl border border-border overflow-hidden">
          <div className="bg-surface-hover/80 px-6 py-4 border-b border-border flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Marquesinas Guardadas</h2>
          </div>
          <div className="p-0">
            {tickers.length === 0 ? (
              <div className="p-12 text-center text-muted">
                No hay marquesinas configuradas.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tickers.map((ticker) => (
                  <li key={ticker.id} className="p-6 hover:bg-surface-hover/30 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            ticker.is_active 
                              ? "bg-primary/20 text-primary border-primary/30" 
                              : "bg-surface-hover text-muted border-border"
                          }`}>
                            {ticker.is_active ? "Activa" : "Inactiva"}
                          </span>
                          <span className="text-xs text-muted">
                            Pos: {ticker.position === 'top' ? 'Superior' : 'Inferior'} | Vel: {ticker.speed}
                          </span>
                        </div>
                        <div 
                          className="px-4 py-3 rounded-lg overflow-hidden relative border border-border/50"
                          style={{ backgroundColor: ticker.bg_color }}
                        >
                           <p 
                             className="truncate font-bold text-lg m-0"
                             style={{ color: ticker.text_color }}
                           >
                             {ticker.text}
                           </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => toggleTicker(ticker.id, !ticker.is_active)}
                          className={`p-2 rounded-lg transition-colors flex items-center justify-center border ${
                            ticker.is_active
                              ? "bg-background text-danger hover:bg-danger/10 border-border"
                              : "bg-background text-primary hover:bg-primary/10 border-border"
                          }`}
                          title={ticker.is_active ? "Desactivar" : "Activar"}
                        >
                          {ticker.is_active ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => {
                            if(confirm("¿Seguro que deseas eliminar esta marquesina?")) {
                              deleteTicker(ticker.id);
                            }
                          }}
                          className="p-2 bg-background text-danger hover:bg-danger/10 border border-border rounded-lg transition-colors flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
