import Link from "next/link";
import { getEmployees } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatusPill } from "@/components/ui/StatusPill";
import { EditEmployeeButton } from "./EditEmployeeButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { page?: string };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page)) : 1;

  const { items: employees, totalCount, totalPages } = await getEmployees({ page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Employees" description="Everyone pulled in from a connected device." />

      <Card>
        {employees.length === 0 ? (
          <EmptyState
            title="No employees synced yet"
            description="Add a device and sync it to bring employee records in automatically."
            action={
              <Link href="/devices" className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted">
                Go to devices
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Device user ID</th>
                  <th className="px-4 py-3">Card number</th>
                  <th className="px-4 py-3">Join date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar label={employee.name} />
                        <span className="font-medium text-foreground">{employee.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">{employee.deviceUserId}</td>
                    <td className="px-4 py-3 font-mono text-muted">{employee.cardNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-muted">{employee.joinDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={employee.isActive ? "success" : "neutral"}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <EditEmployeeButton employee={employee} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalCount > 0 && (
        <Pagination page={page} totalPages={totalPages} buildHref={(target) => `/employees?page=${target}`} />
      )}
    </div>
  );
}
