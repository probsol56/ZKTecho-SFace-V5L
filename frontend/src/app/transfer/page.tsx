import { getDevices } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransferForm } from "./TransferForm";

export const dynamic = "force-dynamic";

export default async function TransferPage() {
  const devices = await getDevices();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transfer biometrics"
        description="Copy a person's fingerprint and face templates from one terminal to another."
      />

      <Card className="p-6">
        {devices.length < 2 ? (
          <EmptyState
            title="Add a second device first"
            description="Transferring templates needs at least two registered devices - one source, one target."
          />
        ) : (
          <TransferForm devices={devices} />
        )}
      </Card>
    </div>
  );
}
