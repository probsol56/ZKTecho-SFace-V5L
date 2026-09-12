import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

type PaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeftIcon className="h-4 w-4" />
      </PageLink>

      {getPageNumbers(page, totalPages).map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted">
            &hellip;
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium ${
              entry === page ? "bg-foreground text-background" : "text-muted hover:bg-background"
            }`}
          >
            {entry}
          </Link>
        ),
      )}

      <PageLink href={buildHref(page + 1)} disabled={page >= totalPages} label="Next page">
        <ChevronRightIcon className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${
        disabled ? "pointer-events-none opacity-40" : "text-muted hover:bg-background"
      }`}
    >
      {children}
    </Link>
  );
}

function getPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  const siblingDelta = 1;
  const start = Math.max(2, page - siblingDelta);
  const end = Math.min(totalPages - 1, page + siblingDelta);

  const pages: (number | "ellipsis")[] = [1];
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  if (totalPages > 1) pages.push(totalPages);

  return pages;
}
