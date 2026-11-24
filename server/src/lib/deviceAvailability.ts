import { OFFLINE_AFTER_SECONDS } from "./deviceStatus";

export const AVAILABILITY_WINDOWS = [
  { key: "day", label: "24 horas", milliseconds: 24 * 60 * 60 * 1000 },
  { key: "week", label: "7 días", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { key: "month", label: "30 días", milliseconds: 30 * 24 * 60 * 60 * 1000 },
] as const;

type AvailabilityDevice = {
  id: string;
  last_seen: Date;
  availability_started_at: Date | null;
  availability_tracking_since: Date | null;
};

export type AvailabilityPeriod = {
  device_id: string;
  started_at: Date;
  ended_at: Date;
};

export type AvailabilityTimelineSegment = {
  status: "online" | "offline" | "untracked";
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
};

export type AvailabilityMetric = {
  percent: number | null;
  onlineMs: number;
  observedMs: number;
  downtimeMs: number;
  interruptions: number;
};

export type DeviceAvailabilityMetrics = Record<(typeof AVAILABILITY_WINDOWS)[number]["key"], AvailabilityMetric>;

export type AvailabilityOutage = {
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
};

function overlapMs(start: number, end: number, windowStart: number, windowEnd: number) {
  return Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
}

export function calculateDeviceAvailability(
  device: AvailabilityDevice,
  periods: AvailabilityPeriod[],
  now = Date.now(),
): DeviceAvailabilityMetrics {
  const trackingSince = device.availability_tracking_since?.getTime() ?? now;
  const offlineAllowance = OFFLINE_AFTER_SECONDS * 1000;
  const activeStart = device.availability_started_at?.getTime();
  const activeEnd = Math.min(now, device.last_seen.getTime() + offlineAllowance);

  return Object.fromEntries(AVAILABILITY_WINDOWS.map(window => {
    const requestedStart = now - window.milliseconds;
    const observedStart = Math.max(requestedStart, trackingSince);
    const observedMs = Math.max(0, now - observedStart);
    const completedOnlineMs = periods.reduce((total, period) => total + overlapMs(
      period.started_at.getTime(),
      period.ended_at.getTime(),
      observedStart,
      now,
    ), 0);
    const activeOnlineMs = activeStart === undefined ? 0 : overlapMs(activeStart, activeEnd, observedStart, now);
    const onlineMs = Math.min(observedMs, completedOnlineMs + activeOnlineMs);
    const interruptions = periods.filter(period =>
      period.ended_at.getTime() >= observedStart && period.ended_at.getTime() <= now
    ).length + (activeStart !== undefined && activeEnd < now && activeEnd >= observedStart ? 1 : 0);

    return [window.key, {
      percent: observedMs ? Math.round((onlineMs / observedMs) * 1000) / 10 : null,
      onlineMs,
      observedMs,
      downtimeMs: Math.max(0, observedMs - onlineMs),
      interruptions,
    }];
  })) as DeviceAvailabilityMetrics;
}

export function calculateAvailabilityByDevice(
  devices: AvailabilityDevice[],
  periods: AvailabilityPeriod[],
  now = Date.now(),
) {
  const grouped = new Map<string, AvailabilityPeriod[]>();
  for (const period of periods) {
    const list = grouped.get(period.device_id) ?? [];
    list.push(period);
    grouped.set(period.device_id, list);
  }
  return new Map(devices.map(device => [device.id, calculateDeviceAvailability(device, grouped.get(device.id) ?? [], now)]));
}

export function calculateRecentOutages(
  device: AvailabilityDevice,
  periods: AvailabilityPeriod[],
  now = Date.now(),
): AvailabilityOutage[] {
  const offlineAllowance = OFFLINE_AFTER_SECONDS * 1000;
  const sessions = periods
    .map(period => ({ start: period.started_at.getTime(), end: period.ended_at.getTime() }))
    .sort((a, b) => a.start - b.start);
  const activeStart = device.availability_started_at?.getTime();
  if (activeStart !== undefined) {
    sessions.push({ start: activeStart, end: Math.min(now, device.last_seen.getTime() + offlineAllowance) });
  }

  const outages: AvailabilityOutage[] = [];
  for (let index = 0; index < sessions.length - 1; index += 1) {
    const startedAt = sessions[index].end;
    const endedAt = sessions[index + 1].start;
    if (endedAt > startedAt) {
      outages.push({ startedAt: new Date(startedAt), endedAt: new Date(endedAt), durationMs: endedAt - startedAt });
    }
  }
  const lastSession = sessions.at(-1);
  if (lastSession && lastSession.end < now) {
    outages.push({ startedAt: new Date(lastSession.end), endedAt: null, durationMs: now - lastSession.end });
  }
  return outages.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export function buildAvailabilityTimeline(
  device: AvailabilityDevice,
  periods: AvailabilityPeriod[],
  windowMs: number,
  now = Date.now(),
): AvailabilityTimelineSegment[] {
  const windowStart = now - windowMs;
  const trackingSince = device.availability_tracking_since?.getTime();
  if (trackingSince === undefined || trackingSince >= now) {
    return [{ status: "untracked", startedAt: new Date(windowStart), endedAt: new Date(now), durationMs: windowMs }];
  }

  const observedStart = Math.max(windowStart, trackingSince);
  const offlineAllowance = OFFLINE_AFTER_SECONDS * 1000;
  const sessions = periods.map(period => ({
    start: Math.max(observedStart, period.started_at.getTime()),
    end: Math.min(now, period.ended_at.getTime()),
  }));
  const activeStart = device.availability_started_at?.getTime();
  if (activeStart !== undefined) {
    sessions.push({
      start: Math.max(observedStart, activeStart),
      end: Math.min(now, device.last_seen.getTime() + offlineAllowance),
    });
  }

  const merged = sessions
    .filter(session => session.end > session.start)
    .sort((a, b) => a.start - b.start)
    .reduce<Array<{ start: number; end: number }>>((result, session) => {
      const previous = result.at(-1);
      if (previous && session.start <= previous.end) previous.end = Math.max(previous.end, session.end);
      else result.push({ ...session });
      return result;
    }, []);

  const segments: AvailabilityTimelineSegment[] = [];
  const push = (status: AvailabilityTimelineSegment["status"], start: number, end: number) => {
    if (end > start) segments.push({ status, startedAt: new Date(start), endedAt: new Date(end), durationMs: end - start });
  };
  push("untracked", windowStart, observedStart);
  let cursor = observedStart;
  for (const session of merged) {
    push("offline", cursor, session.start);
    push("online", session.start, session.end);
    cursor = Math.max(cursor, session.end);
  }
  push("offline", cursor, now);
  return segments;
}

export function formatAvailabilityPercent(percent: number | null) {
  return percent === null ? "Reuniendo datos" : `${percent.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function formatAvailabilityDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
