import { getWorkSchedule } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkScheduleForm } from "./WorkScheduleForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const schedule = await getWorkSchedule();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Work schedule"
        description={`Office hours and weekend days used to turn punches into a day's status. Times are in ${schedule.timeZoneId}.`}
      />

      <Card className="max-w-2xl p-6">
        <WorkScheduleForm schedule={schedule} />
      </Card>
    </div>
  );
}
