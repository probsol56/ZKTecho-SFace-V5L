import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AttendanceLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Daily attendance" />
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-9 w-40" />
            </div>
          ))}
          <Skeleton className="h-9 w-20" />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <TableSkeleton columns={7} rows={10} />
      </Card>
    </div>
  );
}
