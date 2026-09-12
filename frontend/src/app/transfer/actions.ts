"use server";

import { revalidatePath } from "next/cache";
import { transferTemplates } from "@/lib/api";

export async function transferTemplatesAction(input: {
  sourceDeviceId: number;
  targetDeviceId: number;
  employeeIds: number[];
}) {
  if (input.sourceDeviceId === input.targetDeviceId) {
    throw new Error("Source and target device must be different.");
  }
  if (input.employeeIds.length === 0) {
    throw new Error("Select at least one employee.");
  }

  const result = await transferTemplates(input);
  revalidatePath("/employees");
  return result;
}
