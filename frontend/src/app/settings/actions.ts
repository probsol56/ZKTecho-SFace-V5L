"use server";

import { revalidatePath } from "next/cache";
import { updateWorkSchedule } from "@/lib/api";

export async function updateWorkScheduleAction(formData: FormData) {
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const graceMinutes = Number(formData.get("graceMinutes") ?? 0);
  const weekendDays = formData.getAll("weekendDays").map(String);

  if (!startTime || !endTime) {
    throw new Error("Start time and end time are required.");
  }

  await updateWorkSchedule({ startTime, endTime, graceMinutes, weekendDays });
  revalidatePath("/settings");
}
