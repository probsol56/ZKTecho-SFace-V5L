import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" description="Live status of connected terminals and today's sync activity." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-4 p-5">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <TableSkeleton columns={5} rows={4} />
      </Card>
    </div>
  );
}
