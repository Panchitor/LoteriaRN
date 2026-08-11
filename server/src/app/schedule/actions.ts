"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";

export async function createSchedule(data: {
  name: string;
  video_ids: string;
  days: string;
  start_time: string;
  end_time: string;
  priority: number;
  group_id?: string | null;
}) {
  await requireAdmin();
  await prisma.schedule.create({
    data: {
      name: data.name,
      video_ids: data.video_ids,
      days: data.days,
      start_time: data.start_time,
      end_time: data.end_time,
      priority: data.priority,
      group_id: data.group_id || null,
      is_active: true,
    }
  });
  revalidatePath('/schedule');
}

export async function toggleSchedule(id: string, is_active: boolean) {
  await requireAdmin();
  await prisma.schedule.update({
    where: { id },
    data: { is_active }
  });
  revalidatePath('/schedule');
}

export async function deleteSchedule(id: string) {
  await requireAdmin();
  await prisma.schedule.delete({
    where: { id }
  });
  revalidatePath('/schedule');
}
