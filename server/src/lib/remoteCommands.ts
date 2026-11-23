import { getDeviceOperationalState } from "./deviceStatus";

export const REMOTE_COMMAND_TTL_MS = 2 * 60 * 1000;

type RemoteCommandDevice = {
  last_seen: Date;
  is_active: boolean;
  installation_id: string | null;
  revoked_at: Date | null;
  last_command_status: string | null;
  last_command_at: Date | null;
};

export function canIssueRemoteCommand(device: RemoteCommandDevice, now = Date.now()) {
  return getDeviceOperationalState(device, now) === "online";
}

export function isRemoteCommandFresh(device: Pick<RemoteCommandDevice, "last_command_status" | "last_command_at">, now = Date.now()) {
  return device.last_command_status === "pending"
    && Boolean(device.last_command_at)
    && now - device.last_command_at!.getTime() <= REMOTE_COMMAND_TTL_MS;
}
