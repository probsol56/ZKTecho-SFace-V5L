"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TrashIcon } from "@/components/icons";
import { deleteDeviceAction } from "./actions";

const CONFIRM_TIMEOUT_MS = 4000;

export function DeleteDeviceButton({ deviceId, deviceName }: { deviceId: number; deviceName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      timeoutRef.current = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    startTransition(async () => {
      await deleteDeviceAction(deviceId);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={confirming ? `Confirm delete ${deviceName}` : `Delete ${deviceName}`}
      className={
        confirming
          ? "rounded-md border border-danger bg-danger-soft px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-danger transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          : "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isPending ? "Removing…" : confirming ? "Confirm delete" : <TrashIcon className="h-4 w-4" />}
    </button>
  );
}
