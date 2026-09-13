"use server";

import { revalidatePath } from "next/cache";
import { updateEmployee } from "@/lib/api";

export async function updateEmployeeAction(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const joinDate = String(formData.get("joinDate") ?? "").trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  await updateEmployee(id, {
    name,
    isActive: formData.get("isActive") === "on",
    joinDate: joinDate || null,
  });

  revalidatePath("/employees");
  revalidatePath("/attendance");
}
