import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function DevicesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Devices" description="Manage the biometric terminals synced into this system." />
      <Card>
        <TableSkeleton columns={5} rows={4} />
      </Card>
      <Card className="max-w-md p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-56" />
        <div className="mt-5 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
