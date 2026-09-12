"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();

  const variantClasses =
    variant === "primary"
      ? "bg-ink text-ink-foreground hover:bg-ink-hover"
      : "border border-border-strong text-foreground hover:bg-background";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
