"use client";

import { useState } from "react";
import type { Employee } from "@/lib/api";
import { EditIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateEmployeeAction } from "./actions";

const inputClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted";

export function EditEmployeeButton({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    setOpen(false);
  };

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    try {
      await updateEmployeeAction(employee.id, formData);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${employee.name}`}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-background hover:text-foreground"
      >
        <EditIcon className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={handleClose} title={`Edit ${employee.name}`}>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Name
            <input name="name" required defaultValue={employee.name} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Join date <span className="font-normal text-muted">(optional)</span>
            <input name="joinDate" type="date" defaultValue={employee.joinDate ?? ""} className={inputClasses} />
            <span className="text-xs font-normal text-muted">
              Days before this date are never counted as absent.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm font-medium text-foreground">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={employee.isActive}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
            />
            <span>
              Currently employed
              <span className="mt-0.5 block text-xs font-normal text-muted">
                Inactive people stop generating absent days but keep their history.
              </span>
            </span>
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
