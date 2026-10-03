"use client";

import * as React from "react";
import { Badge, Button, Card, Input, LoadingState, cn } from "@playora/ui";
import { Flag, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../../lib/store/auth-store";
import { useStaffRole } from "../../../hooks/use-staff";
import {
  useReports,
  type ModerationAction,
  type Report,
  type ReportStatus,
} from "../../../hooks/use-reports";

const FILTERS: Array<{ id: ReportStatus | "all"; label: string }> = [
  { id: "open", label: "Open" },
  { id: "action_taken", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const ACTIONS: Array<{ id: ModerationAction; label: string; hint: string }> = [
  { id: "warn", label: "Warn", hint: "On the record, no restriction" },
  { id: "mute", label: "Mute 24h", hint: "Cannot chat for a day" },
  { id: "suspend", label: "Suspend 7d", hint: "Cannot play for a week" },
  { id: "ban", label: "Ban", hint: "Permanent" },
];

export default function AdminReportsPage() {
  const { user } = useAuthStore();
  const { isStaff } = useStaffRole(user?.id);
  const [filter, setFilter] = React.useState<ReportStatus | "all">("open");
  const { reports, isLoading, error, dismiss, act } = useReports(isStaff, filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === f.id
                ? "border-primary bg-primary/15 text-primary-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState title="Loading reports" />
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5 p-5 text-sm">{error}</Card>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-success" aria-hidden />
          <p className="font-display text-lg font-bold text-foreground">Nothing waiting</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            No reports with this status.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportCard
                report={report}
                actorId={user?.id ?? ""}
                onDismiss={() => dismiss(report.id)}
                onAct={(action, reason) => act(report, action, reason, user?.id ?? "")}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportCard({
  report,
  actorId,
  onDismiss,
  onAct,
}: {
  report: Report;
  actorId: string;
  onDismiss: () => Promise<string | null>;
  onAct: (action: ModerationAction, reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(await fn());
    setBusy(false);
  };

  const open = report.status === "open";

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-warning" aria-hidden />
            <span className="font-display text-sm font-bold text-foreground">
              {report.reportedName}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {report.reason}
            </Badge>
            <Badge
              variant={
                report.status === "open"
                  ? "warning"
                  : report.status === "action_taken"
                    ? "destructive"
                    : "secondary"
              }
              className="text-[10px]"
            >
              {report.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reported by {report.reporterName} ·{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
          {report.details && (
            <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground">
              {report.details}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor={`reason-${report.id}`}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Reason — goes on the permanent record
          </label>
          <Input
            id={`reason-${report.id}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setMessage(null);
            }}
            placeholder="What you found, and why this action"
            className="mt-1"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {ACTIONS.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.id === "ban" ? "destructive" : "outline"}
                title={action.hint}
                disabled={busy || !reason.trim() || !actorId}
                onClick={() => void run(() => onAct(action.id, reason))}
              >
                {action.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(onDismiss)}
            >
              Dismiss
            </Button>
          </div>

          <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-destructive">
            {message}
          </p>
        </div>
      )}
    </Card>
  );
}
