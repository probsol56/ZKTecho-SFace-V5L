"use client";

import { useState } from "react";
import { DeviceFormModal } from "./DeviceFormModal";

export function AddDeviceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-ink-foreground transition-colors hover:bg-ink-hover"
      >
        Add device
      </button>
      <DeviceFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
