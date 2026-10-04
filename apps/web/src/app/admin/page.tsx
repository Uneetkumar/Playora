"use client";

import { Card, Skeleton } from "@playora/ui";
import { DoorOpen, Flag, Swords, Timer, UserCheck, Users, Info } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { useAdminMetrics } from "../../hooks/use-admin-metrics";
import { StatTile } from "../../components/page/stat";

/** The dashboard from spec v2 section 79, limited to what is measurable today. */
export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { isStaff } = useStaffRole(user?.id);
  const { metrics, isLoading } = useAdminMetrics(isStaff);

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {isLoading || !metrics ? (
          Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-[7.25rem] rounded-xl" />
            </li>
          ))
        ) : (
          <>
            <li>
              <StatTile
                icon={<Users />}
                label="Players"
                value={metrics.players.toLocaleString()}
                hint={`${metrics.guests.toLocaleString()} guests`}
              />
            </li>
            <li>
              <StatTile
                icon={<Swords />}
                label="Matches today"
                value={metrics.matchesToday.toLocaleString()}
                hint={`${metrics.matchesWeek.toLocaleString()} this week`}
              />
            </li>
            <li>
              <StatTile
                icon={<DoorOpen />}
                label="Active rooms"
                value={metrics.activeRooms.toLocaleString()}
                hint="Waiting or in a game"
              />
            </li>
            <li>
              <StatTile
                icon={<Timer />}
                label="Average match"
                value={
                  <span className="font-mono-num">
                    {Math.floor(metrics.averageMatchSeconds / 60)}m{" "}
                    {metrics.averageMatchSeconds % 60}s
                  </span>
                }
                hint="Last 200 matches"
              />
            </li>
            <li>
              <StatTile
                icon={<UserCheck />}
                label="Completion"
                value={`${Math.round(metrics.completionRate * 100)}%`}
                hint="Sessions that produced a result"
              />
            </li>
            <li>
              <StatTile
                icon={<Flag />}
                label="Open reports"
                value={metrics.openReports.toLocaleString()}
                hint={metrics.openReports > 0 ? "Needs attention" : "Nothing waiting"}
                tone={metrics.openReports > 0 ? "warning" : "default"}
              />
            </li>
          </>
        )}
      </ul>

      <Card className="flex gap-3 border-dashed bg-card/50 p-5 shadow-none">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Not measured yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live WebSocket connections, reconnect rate, matchmaking latency and the racing telemetry
            from spec section 79 come from the Worker rather than from Postgres, and nothing
            collects them today. They are listed here rather than shown as zeroes, because a
            dashboard reporting zero disconnects is worse than one admitting it does not know.
          </p>
        </div>
      </Card>
    </div>
  );
}
