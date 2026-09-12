import { getDevices, getEmployees } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransferForm } from "./TransferForm";

export const dynamic = "force-dynamic";

const EMPLOYEE_FETCH_LIMIT = 200;

export default async function TransferPage() {
  const [devices, employeePage] = await Promise.all([
    getDevices(),
    getEmployees({ pageSize: EMPLOYEE_FETCH_LIMIT }),
  ]);

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
          <TransferForm devices={devices} employees={employeePage.items} employeeTotalCount={employeePage.totalCount} />
        )}
      </Card>
    </div>
  );
}
