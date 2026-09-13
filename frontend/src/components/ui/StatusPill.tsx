import type { ReactNode } from "react";

export type StatusPillTone = "success" | "neutral" | "warning" | "danger";

const TONE_STYLES: Record<StatusPillTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success", dot: "bg-success" },
  neutral: { pill: "bg-background text-muted", dot: "bg-muted" },
  warning: { pill: "bg-gold-soft text-gold", dot: "bg-gold" },
  danger: { pill: "bg-danger-soft text-danger", dot: "bg-danger" },
};

export function StatusPill({ tone, children }: { tone: StatusPillTone; children: ReactNode }) {
  const styles = TONE_STYLES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles.pill}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}
