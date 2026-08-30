"use client";

import { Card, LoadingState } from "@playora/ui";
import { Users, Swords, DoorOpen, Flag, Timer, UserCheck } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { useAdminMetrics } from "../../hooks/use-admin-metrics";

/** The dashboard from spec v2 section 79, limited to what is measurable today. */
export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { isStaff } = useStaffRole(user?.id);
  const { metrics, isLoading } = useAdminMetrics(isStaff);

  if (isLoading || !metrics) return <LoadingState title="Loading metrics" />;

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          icon={<Users className="h-4 w-4" aria-hidden />}
          label="Players"
          value={metrics.players.toLocaleString()}
          hint={`${metrics.guests.toLocaleString()} guests`}
        />
        <Metric
          icon={<Swords className="h-4 w-4" aria-hidden />}
          label="Matches today"
          value={metrics.matchesToday.toLocaleString()}
          hint={`${metrics.matchesWeek.toLocaleString()} this week`}
        />
        <Metric
          icon={<DoorOpen className="h-4 w-4" aria-hidden />}
          label="Active rooms"
          value={metrics.activeRooms.toLocaleString()}
          hint="waiting or in game"
        />
        <Metric
          icon={<Timer className="h-4 w-4" aria-hidden />}
          label="Average match"
          value={`${Math.floor(metrics.averageMatchSeconds / 60)}m ${metrics.averageMatchSeconds % 60}s`}
          hint="last 200 matches"
        />
        <Metric
          icon={<UserCheck className="h-4 w-4" aria-hidden />}
          label="Completion"
          value={`${Math.round(metrics.completionRate * 100)}%`}
          hint="sessions that produced a result"
        />
        <Metric
          icon={<Flag className="h-4 w-4" aria-hidden />}
          label="Open reports"
          value={metrics.openReports.toLocaleString()}
          hint={metrics.openReports > 0 ? "needs attention" : "nothing waiting"}
          alert={metrics.openReports > 0}
        />
      </ul>

      <Card className="border-dashed border-border bg-card/50 p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Not measured yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Live WebSocket connections, reconnect rate, matchmaking latency and the racing
          telemetry from spec section 79 come from the Worker rather than from Postgres, and
          nothing collects them today. They are listed here rather than shown as zeroes,
          because a dashboard reporting zero disconnects is worse than one admitting it does
          not know.
        </p>
      </Card>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <li>
      <Card className="border-border bg-card p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={`numeric mt-1 font-display text-3xl font-black ${alert ? "text-warning" : "text-foreground"}`}
        >
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </Card>
    </li>
  );
}
