"use client";

import { PageHeader } from "@/components/ui/primitives";
import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { formatRelative } from "@/lib/format";

export default function NotificationsPage() {
  const data = useEntityData();

  const notes = [
    {
      id: "n1",
      title: "Safe-to-invest refreshed",
      body: `Surplus engine reports ${data.surplus.safeToInvest.toLocaleString("en-KE")} KES available.`,
      at: data.asOf,
    },
    {
      id: "n2",
      title: "Obligation approaching",
      body: data.obligations.find((o) => o.status === "upcoming")?.name ?? "Upcoming payment",
      at: data.asOf,
    },
    {
      id: "n3",
      title: "Demo mode reminder",
      body: "No live money movement is enabled in this build.",
      at: data.asOf,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle="Analysis alerts and system status — not trading pings." />
      <ul className="wl-card divide-y divide-wl-border">
        {notes.map((n) => (
          <li key={n.id} className="px-5 py-4">
            <div className="flex justify-between gap-3">
              <p className="font-medium text-wl-text">{n.title}</p>
              <span className="text-[11px] text-wl-muted">{formatRelative(n.at)}</span>
            </div>
            <p className="mt-1 text-sm text-wl-muted">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
