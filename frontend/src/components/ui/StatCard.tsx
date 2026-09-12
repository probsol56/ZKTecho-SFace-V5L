import type { ReactNode } from "react";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const valueTone = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";

  return (
    <Card className="flex items-center gap-4 p-5">
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-muted">
          {icon}
        </span>
      )}
      <div>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tracking-tight ${valueTone}`}>{value}</p>
      </div>
    </Card>
  );
}
