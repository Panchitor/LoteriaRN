import { getDeviceLogs } from "./actions";
import LogsViewerClient from "./LogsViewerClient";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function LogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const logs = await getDeviceLogs(id);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <AutoRefresh intervalMs={3000} />
      
      <div className="flex items-center gap-4">
        <Link href="/monitoring" className="p-2 hover:bg-background rounded-lg text-muted hover:text-white transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Logs del Dispositivo</h1>
          <p className="text-muted mt-1">Dispositivo ID: {id}</p>
        </div>
      </div>

      <LogsViewerClient logs={logs} />
    </div>
  );
}
