"use client";

import { useState } from "react";
import type { WorkSchedule } from "@/lib/api";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateWorkScheduleAction } from "./actions";

const inputClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted";

const DAYS: { value: string; label: string }[] = [
  { value: "Sunday", label: "Sun" },
  { value: "Monday", label: "Mon" },
  { value: "Tuesday", label: "Tue" },
  { value: "Wednesday", label: "Wed" },
  { value: "Thursday", label: "Thu" },
  { value: "Friday", label: "Fri" },
  { value: "Saturday", label: "Sat" },
];

export function WorkScheduleForm({ schedule }: { schedule: WorkSchedule }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setSaved(false);
    try {
      await updateWorkScheduleAction(formData);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Start time
          <input
            name="startTime"
            type="time"
            required
            defaultValue={schedule.startTime.slice(0, 5)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          End time
          <input
            name="endTime"
            type="time"
            required
            defaultValue={schedule.endTime.slice(0, 5)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Grace period (minutes)
          <input
            name="graceMinutes"
            type="number"
            min={0}
            max={240}
            defaultValue={schedule.graceMinutes}
            className={inputClasses}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Weekend days</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-sm text-foreground has-checked:border-ink has-checked:bg-background"
            >
              <input
                type="checkbox"
                name="weekendDays"
                value={day.value}
                defaultChecked={schedule.weekendDays.includes(day.value)}
                className="accent-ink"
              />
              {day.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Changing this does not rewrite already-computed attendance history — recompute the affected date range
          separately.
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-success">Saved.</p>}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
