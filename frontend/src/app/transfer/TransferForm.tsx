"use client";

import { useMemo, useState, useTransition } from "react";
import type { Device, DeviceUser, TemplateTransferOutcome } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { connectToDeviceAction } from "./actions";
import { runTemplateTransfer } from "./transferStream";

const selectClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground disabled:cursor-not-allowed disabled:opacity-60";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export function TransferForm({ devices }: { devices: Device[] }) {
  const [sourceDeviceId, setSourceDeviceId] = useState<string>("");
  const [targetDeviceId, setTargetDeviceId] = useState<string>("");

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sourceEmployees, setSourceEmployees] = useState<DeviceUser[]>([]);
  const [isConnecting, startConnecting] = useTransition();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isPending, startTransition] = useTransition();
  const [transferTotal, setTransferTotal] = useState(0);
  const [result, setResult] = useState<TemplateTransferOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Employees shown must always match the device actually connected to - if
  // the user switches away from it, disconnects, or reconnects, the previous
  // device's list can no longer be trusted and has to be cleared or re-fetched.
  const resetConnection = () => {
    setStatus("idle");
    setConnectError(null);
    setSourceEmployees([]);
    setSelectedIds(new Set());
    setSearch("");
    setResult(null);
    setError(null);
  };

  const handleSourceDeviceChange = (nextSourceDeviceId: string) => {
    setSourceDeviceId(nextSourceDeviceId);
    resetConnection();
    setTargetDeviceId((prev) => (prev === nextSourceDeviceId ? "" : prev));
  };

  const handleDisconnect = () => {
    resetConnection();
    setTargetDeviceId("");
  };

  const handleConnect = () => {
    if (sourceDeviceId === "") return;
    setStatus("connecting");
    setConnectError(null);
    startConnecting(async () => {
      try {
        const users = await connectToDeviceAction(Number(sourceDeviceId));
        setSourceEmployees(users);
        setStatus("connected");
      } catch (err) {
        setStatus("error");
        setConnectError(err instanceof Error ? err.message : "Could not connect to device.");
      }
    });
  };

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sourceEmployees;
    return sourceEmployees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(term) ||
        employee.deviceUserId.toLowerCase().includes(term) ||
        employee.cardNumber?.toLowerCase().includes(term),
    );
  }, [sourceEmployees, search]);

  const allVisibleSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.deviceUserId));

  const toggleEmployee = (deviceUserId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceUserId)) {
        next.delete(deviceUserId);
      } else {
        next.add(deviceUserId);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const employee of filteredEmployees) next.delete(employee.deviceUserId);
      } else {
        for (const employee of filteredEmployees) next.add(employee.deviceUserId);
      }
      return next;
    });
  };

  const sourceDevice = devices.find((d) => String(d.id) === sourceDeviceId);
  const targetDevices = devices.filter((d) => String(d.id) !== sourceDeviceId);
  const canSubmit = status === "connected" && targetDeviceId !== "" && selectedIds.size > 0 && !isPending;

  const handleSubmit = () => {
    setError(null);
    const selectedEmployees = sourceEmployees.filter((e) => selectedIds.has(e.deviceUserId));
    setTransferTotal(selectedEmployees.length);
    setResult([]);
    startTransition(async () => {
      try {
        await runTemplateTransfer(
          {
            sourceDeviceId: Number(sourceDeviceId),
            targetDeviceId: Number(targetDeviceId),
            employees: selectedEmployees,
          },
          (outcome) => setResult((prev) => [...(prev ?? []), outcome]),
        );
        setSelectedIds(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-1 text-xs font-medium text-muted">
        <li>1. Connect to the source device to load who is enrolled on it.</li>
        <li>2. Select the employees to copy.</li>
        <li>3. Choose a target device and transfer.</li>
      </ol>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="source-device">
            Source device
          </label>
          <div className="flex items-center gap-2">
            <select
              id="source-device"
              value={sourceDeviceId}
              onChange={(e) => handleSourceDeviceChange(e.target.value)}
              disabled={isConnecting}
              className={`flex-1 ${selectClasses}`}
            >
              <option value="">Select source device…</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.ipAddress})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleConnect}
              disabled={sourceDeviceId === "" || isConnecting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : status === "connected" ? "Reconnect" : status === "error" ? "Retry" : "Connect"}
            </button>
            {(status === "connected" || status === "error") && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="shrink-0 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Disconnect
              </button>
            )}
          </div>
          {status === "connected" && sourceDevice && (
            <StatusPill tone="success">Connected to {sourceDevice.name}</StatusPill>
          )}
          {status === "error" && connectError && <p className="text-sm text-danger">{connectError}</p>}
        </div>

        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
          Target device
          <select
            value={targetDeviceId}
            onChange={(e) => setTargetDeviceId(e.target.value)}
            disabled={status !== "connected"}
            className={selectClasses}
          >
            <option value="">Select target device…</option>
            {targetDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.ipAddress})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
            Employees on source device
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, device user ID, or card number"
              disabled={status !== "connected"}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>

        <div className="rounded-md border border-border">
          {status === "idle" || status === "error" ? (
            <EmptyState
              title="No device connected"
              description="Select a source device above and click Connect to load its enrolled employees."
            />
          ) : status === "connecting" ? (
            <TableSkeleton columns={4} rows={5} />
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-border bg-background text-left text-xs font-medium text-muted uppercase">
                    <th className="w-10 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        disabled={filteredEmployees.length === 0}
                        aria-label="Select all visible employees"
                        className="h-4 w-4 rounded border-border-strong"
                      />
                    </th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Device user ID</th>
                    <th className="px-4 py-2">Card number</th>
                    <th className="px-4 py-2 text-right">
                      {selectedIds.size} of {sourceEmployees.length} selected
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                        {sourceEmployees.length === 0
                          ? "No employees are enrolled on this device."
                          : "No employees match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <tr
                        key={employee.deviceUserId}
                        onClick={() => toggleEmployee(employee.deviceUserId)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(employee.deviceUserId)}
                            onChange={() => toggleEmployee(employee.deviceUserId)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 rounded border-border-strong"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{employee.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted">{employee.deviceUserId}</td>
                        <td className="px-4 py-2.5 text-xs text-muted">{employee.cardNumber ?? "—"}</td>
                        <td className="px-4 py-2.5" />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-ink-foreground transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? `Transferring ${result?.length ?? 0} of ${transferTotal}…`
            : `Transfer ${selectedIds.size || ""} template${selectedIds.size === 1 ? "" : "s"}`}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {result && (
        <div className="flex flex-col gap-2">
          {isPending && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={result.length} aria-valuemin={0} aria-valuemax={transferTotal}>
              <div
                className="h-full rounded-full bg-ink transition-[width]"
                style={{ width: `${transferTotal > 0 ? (result.length / transferTotal) * 100 : 0}%` }}
              />
            </div>
          )}
          <div className="rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {result.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-sm text-muted">
                      {isPending ? "Starting transfer…" : "No employees were transferred."}
                    </td>
                  </tr>
                ) : (
                  result.map((outcome) => (
                    <tr key={outcome.deviceUserId} className="border-b border-border last:border-0">
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
                  ))
                )}
                {isPending && result.length > 0 && result.length < transferTotal && (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center text-xs text-muted">
                      Transferring remaining {transferTotal - result.length}…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
