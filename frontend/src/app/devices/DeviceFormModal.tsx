"use client";

import { useState } from "react";
import type { Device } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addDeviceAction, updateDeviceAction } from "./actions";

const inputClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted";

export function DeviceFormModal({
  open,
  onClose,
  device,
}: {
  open: boolean;
  onClose: () => void;
  device?: Device;
}) {
  const [error, setError] = useState<string | null>(null);
  const isEditing = device !== undefined;

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    try {
      if (device) {
        await updateDeviceAction(device.id, formData);
      } else {
        await addDeviceAction(formData);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEditing ? `Edit ${device.name}` : "Add a device"}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Name
          <input
            name="name"
            required
            defaultValue={device?.name}
            className={inputClasses}
            placeholder="e.g. Main entrance"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          IP address
          <input
            name="ipAddress"
            required
            inputMode="numeric"
            defaultValue={device?.ipAddress}
            className={inputClasses}
            placeholder="e.g. 192.168.1.201"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Port
          <input
            name="port"
            type="number"
            inputMode="numeric"
            defaultValue={device?.port ?? 4370}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Serial number <span className="font-normal text-muted">(optional)</span>
          <input name="serialNumber" defaultValue={device?.serialNumber ?? ""} className={inputClasses} />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Cancel
          </button>
          <SubmitButton pendingLabel={isEditing ? "Saving…" : "Adding device…"}>
            {isEditing ? "Save changes" : "Add device"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
