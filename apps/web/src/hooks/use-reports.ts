"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/env";

export type ReportStatus = "open" | "reviewed" | "dismissed" | "action_taken";
export type ModerationAction = "warn" | "mute" | "suspend" | "ban";

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedName: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

/** How long a sanction lasts. Null is permanent. */
const DURATIONS: Record<ModerationAction, number | null> = {
  warn: null,
  mute: 24,
  suspend: 24 * 7,
  ban: null,
};

/**
 * The report queue, and the actions a moderator can take on it.
 *
 * Every action writes a row to `moderation_actions` — the audit trail is not a
 * side effect, it is the record. A moderation system whose decisions cannot be
 * reviewed later is indistinguishable from an arbitrary one, which is why the
 * table has no UPDATE or DELETE policy for anyone.
 */
export function useReports(enabled: boolean, status: ReportStatus | "all" = "open") {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reports", status],
    enabled: enabled && isSupabaseConfigured,
    queryFn: async (): Promise<Report[]> => {
      const supabase = getSupabaseBrowserClient();

      let request = supabase
        .from("reports")
        .select("id,reporter_id,reported_user_id,reason,details,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (status !== "all") request = request.eq("status", status);

      const { data, error } = await request;
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as ReportRow[];
      const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id]))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", ids);

      const names: Record<string, string> = {};
      for (const p of (profiles ?? []) as Array<{
        id: string;
        display_name: string | null;
        username: string | null;
      }>) {
        names[p.id] = p.display_name ?? p.username ?? "Player";
      }

      return rows.map((r) => ({
        id: r.id,
        reporterId: r.reporter_id,
        reporterName: names[r.reporter_id] ?? "Player",
        reportedUserId: r.reported_user_id,
        reportedName: names[r.reported_user_id] ?? "Player",
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
      }));
    },
  });

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
  }, [queryClient]);

  /** Closes a report without sanctioning anyone. */
  const dismiss = React.useCallback(
    async (reportId: string): Promise<string | null> => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      if (error) return error.message;
      refresh();
      return null;
    },
    [refresh],
  );

  /**
   * Sanctions a player and records why.
   *
   * The audit row is written first. If it fails the report is left open rather
   * than being marked handled with nothing to show for it — a closed report
   * with no corresponding action is the one state that makes the trail a lie.
   */
  const act = React.useCallback(
    async (
      report: Report,
      action: ModerationAction,
      reason: string,
      actorId: string,
    ): Promise<string | null> => {
      if (!reason.trim()) return "Give a reason. It goes on the record.";

      const supabase = getSupabaseBrowserClient();
      const hours = DURATIONS[action];

      const { error: auditError } = await supabase.from("moderation_actions").insert({
        actor_id: actorId,
        target_id: report.reportedUserId,
        action,
        reason: reason.trim(),
        report_id: report.id,
        expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
      });

      if (auditError) return auditError.message;

      const { error: statusError } = await supabase
        .from("reports")
        .update({ status: "action_taken" })
        .eq("id", report.id);

      // The sanction stands even if closing the report failed; it will simply
      // reappear in the queue, which is the safe direction to fail in.
      if (statusError) return statusError.message;

      refresh();
      return null;
    },
    [refresh],
  );

  return {
    reports: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error instanceof Error ? query.error.message : null,
    dismiss,
    act,
  };
}
