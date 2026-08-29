"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@playden/ui";
import { Gamepad2, User, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { signInAsGuest } = useAuthStore();
  const [guestName, setGuestName] = React.useState("");

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signInAsGuest({ preferredUsername: guestName.trim() || undefined });
    router.push("/rooms");
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/30 mb-4">
            <Gamepad2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black text-white">Welcome to Game Platform</CardTitle>
          <CardDescription className="text-slate-400 mt-1">
            Sign in with your Google account or jump right in as a guest player.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* OAuth Google Sign In Placeholder */}
          <Button
            variant="outline"
            className="w-full justify-center gap-3 h-11 border-slate-700 bg-slate-950/80 hover:bg-slate-800"
            onClick={() => {
              signInAsGuest({ preferredUsername: "Google_Player" });
              router.push("/rooms");
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
              />
            </svg>
            <span className="font-semibold">Sign in with Google</span>
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative bg-slate-900 px-3 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              Or Play Instantly
            </span>
          </div>

          {/* Guest Sign In Form */}
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Choose a Guest Nickname (Optional)
              </label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. StarWarrior"
                  className="pl-9"
                  maxLength={20}
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 h-11 shadow-indigo-500/25">
              <span>Continue as Guest</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>No password required for instant guest access</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
