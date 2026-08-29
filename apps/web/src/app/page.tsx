import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@playden/ui";
import { Gamepad2, Zap, Shield, Globe2, ArrowRight, Play, Users, Trophy } from "lucide-react";
import { JoinByCode } from "../components/rooms/join-by-code";
import { isGameImplemented } from "../lib/play/modes";
import type { GameId } from "@playden/game-types";

export default function HomePage() {
  const featuredGames = [
    {
      id: "chess",
      name: "Chess",
      category: "Board Game",
      players: "2 Players",
      description: "Strategic classic board game with clock timers and full move validation.",
      status: "Engine Ready",
      color: "from-amber-500/20 to-orange-500/10",
    },
    {
      id: "uno",
      name: "UNO Classic",
      category: "Card Game",
      players: "2-4 Players",
      description: "Fast action color/number matching card game with action cards.",
      status: "Engine Ready",
      color: "from-red-500/20 to-rose-500/10",
    },
    {
      id: "uno-no-mercy",
      name: "UNO No Mercy",
      category: "Card Game",
      players: "2-6 Players",
      description: "Brutal card combat with stacking draw penalties and wild roulette.",
      status: "Engine Ready",
      color: "from-purple-500/20 to-pink-500/10",
    },
    {
      id: "car-race",
      name: "Car Race",
      category: "Arcade Racing",
      players: "2-8 Players",
      description: "Top-down multiplayer arcade physics racing with drift mechanics.",
      status: "Engine Ready",
      color: "from-cyan-500/20 to-blue-500/10",
    },
    {
      id: "bike-race",
      name: "Bike Race",
      category: "Physics Racing",
      players: "2-8 Players",
      description: "Precision motorcycle stunt racing across challenging obstacle tracks.",
      status: "Engine Ready",
      color: "from-emerald-500/20 to-teal-500/10",
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28 border-b border-slate-800/60 bg-gradient-to-b from-indigo-950/30 via-[#080c14] to-[#080c14]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />

        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 text-center">
          <Badge variant="default" className="mb-6 px-3 py-1 text-xs">
            ⚡ Free to play · No download · Works offline
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Next-Gen Multiplayer <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Gaming Platform
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl">
            Play chess against the computer, pass the device to a friend, or challenge
            someone online. No account needed to start.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/play">
              <Button size="lg" className="gap-2 shadow-lg shadow-indigo-600/30">
                <Play className="h-5 w-5 fill-current" />
                <span>Play Now</span>
              </Button>
            </Link>
            <Link href="/games">
              <Button variant="outline" size="lg" className="gap-2">
                <Gamepad2 className="h-5 w-5" />
                <span>Browse Games</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mx-auto mt-10 w-full max-w-md">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Got a code from a friend?
            </p>
            <JoinByCode />
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="py-16 bg-slate-950/40 border-b border-slate-800/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900/40 border-slate-800">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-2">
                  <Zap className="h-6 w-6" />
                </div>
                <CardTitle>Edge Realtime</CardTitle>
                <CardDescription>
                  Cloudflare Durable Objects provide single-digit ms room coordination and state
                  synchronization.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/40 border-slate-800">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-2">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle>Deterministic Engines</CardTitle>
                <CardDescription>
                  Isolated game engines handle rule verification, action execution, and state
                  masking.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/40 border-slate-800">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-2">
                  <Globe2 className="h-6 w-6" />
                </div>
                <CardTitle>Persistent Storage</CardTitle>
                <CardDescription>
                  Supabase PostgreSQL stores profiles, game catalogs, match history, and social
                  friendships.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Upcoming & Supported Games</h2>
              <p className="text-sm text-slate-400 mt-1">
                Modular games built on the platform engine framework
              </p>
            </div>
            <Link href="/games">
              <Button variant="ghost" size="sm" className="gap-1 text-indigo-400">
                <span>View All</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredGames.map((game) => (
              <Card
                key={game.id}
                className="group hover:border-slate-700 transition-all duration-300 hover:shadow-indigo-500/10"
              >
                <div
                  className={`h-28 rounded-t-xl bg-gradient-to-br ${game.color} p-4 flex flex-col justify-between`}
                >
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary" className="text-xs bg-slate-900/80">
                      {game.category}
                    </Badge>
                    <Badge variant="success" className="text-xs">
                      {game.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-300 font-medium">
                    <Users className="h-3.5 w-3.5" />
                    <span>{game.players}</span>
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg group-hover:text-indigo-400 transition-colors">
                    {game.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{game.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isGameImplemented(game.id as GameId) ? (
                    <Link href="/play">
                      <Button className="w-full gap-2">
                        <Play className="h-4 w-4 fill-current" />
                        <span>Play</span>
                      </Button>
                    </Link>
                  ) : (
                    <Button className="w-full gap-2" variant="outline" disabled>
                      <Trophy className="h-4 w-4" />
                      <span>Coming soon</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
