"use client";

import { useMemo, useState, useTransition } from "react";
import type { Device, Employee, TemplateTransferResult } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { transferTemplatesAction } from "./actions";

const selectClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground disabled:cursor-not-allowed disabled:opacity-60";

export function TransferForm({
  devices,
  employees,
  employeeTotalCount,
}: {
  devices: Device[];
  employees: Employee[];
  employeeTotalCount: number;
}) {
  const [sourceDeviceId, setSourceDeviceId] = useState<string>("");
  const [targetDeviceId, setTargetDeviceId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TemplateTransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(term) ||
        employee.deviceUserId.toLowerCase().includes(term) ||
        employee.cardNumber?.toLowerCase().includes(term),
    );
  }, [employees, search]);

  const allVisibleSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.id));

  const toggleEmployee = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const employee of filteredEmployees) next.delete(employee.id);
      } else {
        for (const employee of filteredEmployees) next.add(employee.id);
      }
      return next;
    });
  };

  const sameDevice = sourceDeviceId !== "" && sourceDeviceId === targetDeviceId;
  const canSubmit = sourceDeviceId !== "" && targetDeviceId !== "" && !sameDevice && selectedIds.size > 0 && !isPending;

  const handleSubmit = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const outcome = await transferTemplatesAction({
          sourceDeviceId: Number(sourceDeviceId),
          targetDeviceId: Number(targetDeviceId),
          employeeIds: Array.from(selectedIds),
        });
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
          From device
          <select
            value={sourceDeviceId}
            onChange={(e) => setSourceDeviceId(e.target.value)}
            className={selectClasses}
          >
            <option value="">Select source device…</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.ipAddress})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
          To device
          <select
            value={targetDeviceId}
            onChange={(e) => setTargetDeviceId(e.target.value)}
            className={selectClasses}
          >
            <option value="">Select target device…</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.ipAddress})
              </option>
            ))}
          </select>
        </label>
      </div>
      {sameDevice && <p className="text-sm text-danger">Source and target device must be different.</p>}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
            Employees
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, device user ID, or card number"
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted"
            />
          </label>
        </div>
        {employeeTotalCount > employees.length && (
          <p className="text-xs text-muted">
            Showing the first {employees.length} of {employeeTotalCount} employees. Search to narrow the list.
          </p>
        )}

        <div className="rounded-md border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2 text-xs font-medium text-muted uppercase">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label="Select all visible employees"
              className="h-4 w-4 rounded border-border-strong"
            />
            <span>{selectedIds.size} selected</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No employees match your search.</p>
            ) : (
              filteredEmployees.map((employee) => (
                <label
                  key={employee.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-background"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                    className="h-4 w-4 shrink-0 rounded border-border-strong"
                  />
                  <span className="font-medium text-foreground">{employee.name}</span>
                  <span className="font-mono text-xs text-muted">{employee.deviceUserId}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-ink-foreground transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Transferring…" : `Transfer ${selectedIds.size || ""} template${selectedIds.size === 1 ? "" : "s"}`}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {result && (
        <div className="rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {result.outcomes.map((outcome) => (
                <tr key={outcome.employeeId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{outcome.employeeName}</td>
                  <td className="px-4 py-3">
                    {outcome.success ? (
                      <StatusPill tone="success">Transferred</StatusPill>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <StatusPill tone="danger">Failed</StatusPill>
                        {outcome.error && <span className="text-xs text-muted">{outcome.error}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
