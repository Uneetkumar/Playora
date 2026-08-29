"use client";

import * as React from "react";
import { Card, Button, Badge, Avatar } from "@playden/ui";
import { Trophy, Swords, Flame, LogOut, Shield } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuthStore();

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  const displayName = user?.displayName || "Champion Gamer";
  const username = user?.username || "player_one";
  const isGuest = user?.isGuest ?? true;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Profile Header Card */}
      <Card className="p-8 border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/30">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 text-center md:text-left">
            <Avatar fallbackText={displayName} size="xl" className="ring-4 ring-indigo-500/20" />
            <div>
              <div className="flex items-center space-x-3 justify-center md:justify-start">
                <h1 className="text-2xl font-black text-white">{displayName}</h1>
                {isGuest ? (
                  <Badge variant="warning">Guest Account</Badge>
                ) : (
                  <Badge variant="success">Verified Player</Badge>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">@{username}</p>
              <p className="text-xs text-slate-500 mt-2">Member since August 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <Button variant="destructive" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/60 text-center">
            <div className="flex justify-center text-indigo-400 mb-1">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black text-white">1,450</div>
            <div className="text-xs text-slate-400 mt-0.5">Rating (ELO)</div>
          </div>

          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/60 text-center">
            <div className="flex justify-center text-purple-400 mb-1">
              <Swords className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black text-white">48</div>
            <div className="text-xs text-slate-400 mt-0.5">Matches Played</div>
          </div>

          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/60 text-center">
            <div className="flex justify-center text-emerald-400 mb-1">
              <Shield className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black text-white">32</div>
            <div className="text-xs text-slate-400 mt-0.5">Victories</div>
          </div>

          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/60 text-center">
            <div className="flex justify-center text-amber-400 mb-1">
              <Flame className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black text-white">67%</div>
            <div className="text-xs text-slate-400 mt-0.5">Win Rate</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
