"use client";

import { useState, useTransition } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestDeviceRestart, requestDeviceScreenshot } from "./actions";

export function RemoteControls({ deviceId, screenshotPending, restartPending, screenshotUnsupported }: { deviceId: string; screenshotPending: boolean; restartPending: boolean; screenshotUnsupported: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const run = (action: "screenshot" | "restart") => {
    if (action === "restart" && !confirm("¿Reiniciar remotamente la aplicación de este TV?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        if (action === "screenshot") await requestDeviceScreenshot(deviceId);
        else await requestDeviceRestart(deviceId);
        setMessage(action === "screenshot" ? "Captura solicitada. Puede demorar unos segundos." : "Reinicio solicitado.");
        router.refresh();
      } catch {
        setMessage("No se pudo enviar la orden.");
      }
    });
  };

  return <div>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => run("screenshot")} disabled={isPending || screenshotPending || screenshotUnsupported} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50">
        <Camera className="h-4 w-4" />{screenshotUnsupported ? "Captura no compatible" : screenshotPending ? "Captura pendiente" : "Solicitar captura"}
      </button>
      <button onClick={() => run("restart")} disabled={isPending || restartPending} className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-50">
        <RefreshCw className="h-4 w-4" />{restartPending ? "Reinicio pendiente" : "Reiniciar aplicación"}
      </button>
    </div>
    {screenshotUnsupported && <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">Este TV Box utiliza Android anterior a 8. El monitoreo, las alertas y el reinicio remoto funcionan normalmente, pero el firmware no permite capturar la imagen.</p>}
    {message && !screenshotUnsupported && <p className="mt-3 text-xs text-muted">{message}</p>}
  </div>;
}
