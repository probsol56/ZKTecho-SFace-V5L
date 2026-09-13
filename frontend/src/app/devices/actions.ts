"use server";

import { revalidatePath } from "next/cache";
import { createDevice, deleteDevice, syncDevice, updateDevice } from "@/lib/api";

function parseDeviceFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const ipAddress = String(formData.get("ipAddress") ?? "").trim();
  const port = Number(formData.get("port") ?? 4370);
  const serialNumber = String(formData.get("serialNumber") ?? "").trim();

  if (!name || !ipAddress) {
    throw new Error("Name and IP address are required.");
  }

  return { name, ipAddress, port, serialNumber: serialNumber || undefined };
}

export async function addDeviceAction(formData: FormData) {
  await createDevice(parseDeviceFormData(formData));
  revalidatePath("/devices");
}

export async function updateDeviceAction(id: number, formData: FormData) {
  await updateDevice(id, parseDeviceFormData(formData));
  revalidatePath("/devices");
}

export async function deleteDeviceAction(id: number) {
  await deleteDevice(id);
  revalidatePath("/devices");
}

export async function syncDeviceAction(id: number) {
  const result = await syncDevice(id);
  revalidatePath("/devices");
  revalidatePath("/logs");
  revalidatePath("/employees");
  return result;
}
