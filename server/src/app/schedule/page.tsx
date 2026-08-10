import { prisma } from "@/lib/prisma";
import ScheduleClient from "./ScheduleClient";
import { Calendar } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const schedules = await prisma.schedule.findMany({
    include: {
      group: {
        select: { name: true, color: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  const videos = await prisma.video.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true,
      original_name: true,
      media_type: true
    }
  });

  const groups = await prisma.deviceGroup.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      color: true
    }
  });

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            Programación Horaria
          </h1>
          <p className="text-muted mt-2">
            Configura cuándo y dónde se reproducirá el contenido.
          </p>
        </div>
      </div>
      <ScheduleClient initialSchedules={schedules} videos={videos} groups={groups} />
    </div>
  );
}
