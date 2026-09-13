"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { CalendarIcon, CloseIcon, DeviceIcon, LogsIcon, MenuIcon, PeopleIcon, PulseIcon, TransferIcon } from "./icons";

const links = [
  { href: "/", label: "Dashboard", Icon: PulseIcon },
  { href: "/devices", label: "Devices", Icon: DeviceIcon },
  { href: "/attendance", label: "Daily attendance", Icon: CalendarIcon },
  { href: "/logs", label: "Attendance logs", Icon: LogsIcon },
  { href: "/employees", label: "Employees", Icon: PeopleIcon },
  { href: "/transfer", label: "Transfer biometrics", Icon: TransferIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight">SFPL Attendance</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="app-sidebar"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-background"
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden items-center gap-3 border-b border-border px-6 py-5 lg:flex">
          <BrandMark className="h-10 w-10 shrink-0" />
          <div>
            <p className="text-sm font-semibold tracking-tight">SFPL</p>
            <p className="text-xs text-muted">Attendance</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 lg:mt-2" aria-label="Primary">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-background font-semibold text-foreground" : "font-medium text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-gold" : "bg-transparent"}`} aria-hidden="true" />
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-6 py-4 text-xs text-muted">ZKTeco device fleet</div>
      </aside>
    </>
  );
}
