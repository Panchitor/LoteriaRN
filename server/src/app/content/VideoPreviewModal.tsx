"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

export function VideoPreviewModal({ filename, title }: { filename: string; title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-primary hover:text-white hover:bg-primary/80 rounded-lg transition-colors shadow-sm shadow-primary/10 border border-transparent hover:border-primary/50"
        title="Reproducir"
      >
        <Play className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl  w-full max-w-4xl shadow-2xl relative overflow-hidden flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-border bg-surface-hover/50">
              <h3 className="text-white font-semibold truncate pr-8">{title}</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <video 
                src={`/api/videos/${filename}`} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              >
                Tu navegador no soporta la etiqueta de video.
              </video>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
