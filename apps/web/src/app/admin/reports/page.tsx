"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@playora/ui";
import { Flag, Info, ShieldCheck } from "lucide-react";
import { EmptyState } from "../../../components/page/empty-state";
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
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => v && setFilter(v as ReportStatus | "all")}
        aria-label="Report status"
        className="w-full sm:w-auto"
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f.id} value={f.id} className="flex-1 sm:flex-none">
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {isLoading ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading reports</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-ink"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : reports.length === 0 ? (
        <EmptyState
          tone={filter === "open" ? "success" : "default"}
          icon={<ShieldCheck />}
          title={filter === "open" ? "Nothing waiting" : "No reports here"}
          body={
            filter === "open" ? "Every report has been dealt with." : "No reports with this status."
          }
        />
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
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-warning" aria-hidden />
            <span className="font-display text-sm font-bold text-foreground">
              {report.reportedName}
            </span>
            <Badge variant="outline">{report.reason}</Badge>
            <Badge
              variant={
                report.status === "open"
                  ? "warning"
                  : report.status === "action_taken"
                    ? "destructive"
                    : "secondary"
              }
            >
              {report.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleString()}
          </p>
          {report.details && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              {report.details}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor={`reason-${report.id}`}
            className="text-tag uppercase text-muted-foreground"
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
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  {/* A span, so the hint still shows while the button is disabled. */}
                  <span
                    tabIndex={busy || !reason.trim() || !actorId ? 0 : -1}
                    className="inline-flex rounded-md"
                  >
                    <Button
                      size="sm"
                      variant={action.id === "ban" ? "destructive" : "outline"}
                      disabled={busy || !reason.trim() || !actorId}
                      onClick={() => void run(() => onAct(action.id, reason))}
                    >
                      {action.label}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{action.hint}</TooltipContent>
              </Tooltip>
            ))}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(onDismiss)}>
              Dismiss
            </Button>
          </div>

          <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-destructive-ink">
            {message}
          </p>
        </div>
      )}
    </Card>
  );
}
