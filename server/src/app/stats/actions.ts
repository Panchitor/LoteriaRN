import { prisma } from "@/lib/prisma";

export async function getStats() {
  const totalPlaybacks = await prisma.playbackStat.count({
    where: { completed: true }
  });

  const topVideosRaw = await prisma.playbackStat.groupBy({
    by: ['filename'],
    _count: {
      filename: true,
    },
    where: { completed: true },
    orderBy: {
      _count: {
        filename: 'desc',
      },
    },
    take: 10,
  });

  const topVideos = topVideosRaw.map(v => ({
    filename: v.filename,
    count: v._count.filename,
  }));

  // Timeline for last 24 hours
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const timelineRaw = await prisma.playbackStat.findMany({
    where: {
      started_at: { gte: yesterday },
      completed: true,
    },
    select: {
      started_at: true,
    }
  });

  const timelineMap = new Map<string, number>();
  for (let i = 0; i <= 24; i++) {
    const d = new Date(yesterday);
    d.setHours(d.getHours() + i);
    const label = `${d.getHours().toString().padStart(2, '0')}:00`;
    timelineMap.set(label, 0);
  }

  timelineRaw.forEach(stat => {
    const label = `${stat.started_at.getHours().toString().padStart(2, '0')}:00`;
    if (timelineMap.has(label)) {
      timelineMap.set(label, timelineMap.get(label)! + 1);
    }
  });

  const timeline = Array.from(timelineMap.entries()).map(([time, count]) => ({
    time,
    count
  }));

  return {
    totalPlaybacks,
    topVideos,
    timeline,
  };
}
