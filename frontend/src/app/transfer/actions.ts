"use server";

import { getDeviceLiveUsers, type DeviceUser } from "@/lib/api";

export async function connectToDeviceAction(deviceId: number): Promise<DeviceUser[]> {
  return getDeviceLiveUsers(deviceId);
}
