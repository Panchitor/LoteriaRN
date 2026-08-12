export type DeviceOperationalState = "online" | "delayed" | "offline" | "inactive" | "unlinked";

export const ONLINE_AFTER_SECONDS = 60;
export const OFFLINE_AFTER_SECONDS = 180;

type DeviceStatusInput = {
  last_seen: Date;
  is_active: boolean;
  installation_id: string | null;
  revoked_at: Date | null;
};

export function getDeviceOperationalState(device: DeviceStatusInput, now = Date.now()): DeviceOperationalState {
  if (!device.is_active) return "inactive";
  if (!device.installation_id || device.revoked_at) return "unlinked";
  const ageSeconds = Math.max(0, (now - device.last_seen.getTime()) / 1000);
  if (ageSeconds < ONLINE_AFTER_SECONDS) return "online";
  if (ageSeconds < OFFLINE_AFTER_SECONDS) return "delayed";
  return "offline";
}

export function operationalStateLabel(state: DeviceOperationalState) {
  return { online: "Online", delayed: "Demorado", offline: "Offline", inactive: "Inactivo", unlinked: "Sin vincular" }[state];
}
