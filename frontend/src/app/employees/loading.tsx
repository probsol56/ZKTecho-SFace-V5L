import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function EmployeesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Employees" description="Everyone pulled in from a connected device." />
      <Card>
        <TableSkeleton columns={3} rows={6} />
      </Card>
    </div>
  );
}
