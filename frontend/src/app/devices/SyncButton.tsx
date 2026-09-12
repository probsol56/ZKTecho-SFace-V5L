"use client";

import { useState, useTransition } from "react";
import { syncDeviceAction } from "./actions";

export function SyncButton({ deviceId }: { deviceId: number }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncDeviceAction(deviceId);
        setIsError(false);
        setMessage(`Synced: ${result.usersUpserted} users, ${result.logsInserted} new logs`);
      } catch (err) {
        setIsError(true);
        setMessage(err instanceof Error ? err.message : "Sync failed");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink-foreground transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {message && <span className={`text-xs ${isError ? "text-danger" : "text-muted"}`}>{message}</span>}
    </div>
  );
}
