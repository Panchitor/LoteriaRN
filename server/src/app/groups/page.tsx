import { prisma } from "@/lib/prisma";
import GroupsClient from "./GroupsClient";
import { FolderTree } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const groups = await prisma.deviceGroup.findMany({
    include: {
      _count: {
        select: { devices: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  const devices = await prisma.device.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      agency_id: true,
      group_id: true,
      agency: {
        select: { name: true, number: true }
      }
    }
  });

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FolderTree className="h-8 w-8 text-primary" />
            Grupos de Pantallas
          </h1>
          <p className="text-muted mt-2">
            Organiza las pantallas en grupos para programar contenido específico.
          </p>
        </div>
      </div>
      <GroupsClient initialGroups={groups} initialDevices={devices} />
    </div>
  );
}
