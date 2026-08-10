"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  created_at: Date;
}

export default function LogsViewerClient({ logs }: { logs: LogEntry[] }) {
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const filteredLogs = logs.filter(log => {
    if (filterLevel === "all") return true;
    return log.level.toLowerCase() === filterLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error": return "text-danger";
      case "warn":
      case "warning": return "text-yellow-400";
      case "info": return "text-blue-400";
      default: return "text-muted";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button 
          onClick={() => setFilterLevel("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterLevel === "all" ? "bg-primary text-white" : "bg-background text-muted hover:text-white"}`}
        >
          Todos
        </button>
        <button 
          onClick={() => setFilterLevel("info")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterLevel === "info" ? "bg-blue-500 text-white" : "bg-background text-muted hover:text-white"}`}
        >
          Info
        </button>
        <button 
          onClick={() => setFilterLevel("warn")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterLevel === "warn" ? "bg-yellow-500 text-white" : "bg-background text-muted hover:text-white"}`}
        >
          Warning
        </button>
        <button 
          onClick={() => setFilterLevel("error")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterLevel === "error" ? "bg-danger text-white" : "bg-background text-muted hover:text-white"}`}
        >
          Error
        </button>
      </div>

      <div className="glass bg-background rounded-xl border border-border overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto p-4 space-y-2 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-muted py-8">No hay logs para mostrar.</div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="flex gap-4 border-b border-border/50 pb-2 last:border-0">
                <div className="text-muted shrink-0 w-40">
                  {new Date(log.created_at).toLocaleString('es-AR')}
                </div>
                <div className={`font-bold shrink-0 w-16 uppercase ${getLevelColor(log.level)}`}>
                  {log.level}
                </div>
                <div className="text-white break-all">
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
