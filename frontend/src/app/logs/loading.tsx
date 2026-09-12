import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function LogsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Attendance logs" />
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-9 w-40" />
            </div>
          ))}
          <Skeleton className="h-9 w-20" />
        </div>
      </Card>
      <Card>
        <TableSkeleton columns={4} rows={8} />
      </Card>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}
