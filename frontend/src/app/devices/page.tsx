import { getDevices } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddDeviceButton } from "./AddDeviceButton";
import { DeleteDeviceButton } from "./DeleteDeviceButton";
import { EditDeviceButton } from "./EditDeviceButton";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const devices = await getDevices();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Devices"
        description="Manage the biometric terminals synced into this system."
        action={<AddDeviceButton />}
      />

      <Card>
        {devices.length === 0 ? (
          <EmptyState
            title="No devices yet"
            description="Add your first SpeedFace terminal to start syncing employees and attendance logs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">Port</th>
                  <th className="px-4 py-3">Last synced</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar label={device.name} />
                        <span className="font-medium text-foreground">{device.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">{device.ipAddress}</td>
                    <td className="px-4 py-3 font-mono text-muted">{device.port}</td>
                    <td className="px-4 py-3">
                      {device.lastSyncedAt ? (
                        <StatusPill tone="success">{new Date(device.lastSyncedAt).toLocaleString()}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Never synced</StatusPill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <SyncButton deviceId={device.id} />
                        <EditDeviceButton device={device} />
                        <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
