"use client";

import { useState } from "react";
import type { Device } from "@/lib/api";
import { EditIcon } from "@/components/icons";
import { DeviceFormModal } from "./DeviceFormModal";

export function EditDeviceButton({ device }: { device: Device }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${device.name}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-background hover:text-foreground"
      >
        <EditIcon className="h-4 w-4" />
      </button>
      <DeviceFormModal open={open} onClose={() => setOpen(false)} device={device} />
    </>
  );
}
