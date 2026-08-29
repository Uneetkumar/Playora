import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from "@playora/ui";
import { Users, Clock, Eye, Play } from "lucide-react";
import { isGameImplemented } from "../../lib/play/modes";
import type { GameId } from "@playora/game-types";
import Link from "next/link";

export default function GamesPage() {
  const gamesList = [
    {
      id: "chess",
      name: "Chess",
      slug: "chess",
      category: "Board Game",
      minPlayers: 2,
      maxPlayers: 2,
      duration: "10-30 min",
      spectators: true,
      description:
        "Classic 2-player strategic board game with real-time timers, clock controls, and full move validation.",
      status: "Playable Now",
    },
    {
      id: "uno",
      name: "UNO Classic",
      slug: "uno",
      category: "Card Game",
      minPlayers: 2,
      maxPlayers: 4,
      duration: "5-15 min",
      spectators: true,
      description:
        "The classic fast-paced color and number matching card game for up to 4 players.",
      status: "Coming in Phase 5",
    },
    {
      id: "uno-no-mercy",
      name: "UNO No Mercy",
      slug: "uno-no-mercy",
      category: "Card Game",
      minPlayers: 2,
      maxPlayers: 6,
      duration: "10-20 min",
      spectators: true,
      description: "Brutal UNO edition with stacking penalties, wild roulette, and knockout rules.",
      status: "Coming in Phase 6",
    },
    {
      id: "car-race",
      name: "Car Race",
      slug: "car-race",
      category: "Arcade Racing",
      minPlayers: 2,
      maxPlayers: 8,
      duration: "3-8 min",
      spectators: true,
      description: "Top-down 2D arcade physics racing with high-speed drifting and nitro boosts.",
      status: "Coming in Phase 7",
    },
    {
      id: "bike-race",
      name: "Bike Race",
      slug: "bike-race",
      category: "Physics Racing",
      minPlayers: 2,
      maxPlayers: 8,
      duration: "3-8 min",
      spectators: true,
      description:
        "Precision balance and stunt motorcycle physics racing across challenging obstacle tracks.",
      status: "Coming in Phase 8",
    },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Game Catalog
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse supported multiplayer game engines and start or join rooms.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Badge variant="default" className="text-sm px-3 py-1">
            5 Games Configured
          </Badge>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {gamesList.map((game) => (
          <Card
            key={game.id}
            className="flex flex-col justify-between hover:border-border transition-all bg-card/40"
          >
            <div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{game.category}</Badge>
                  <Badge
                    variant={isGameImplemented(game.id as GameId) ? "success" : "secondary"}
                    className="text-xs"
                  >
                    {game.status}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-xl">{game.name}</CardTitle>
                <CardDescription className="mt-2 text-sm leading-relaxed">
                  {game.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    {game.minPlayers} - {game.maxPlayers} Players
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{game.duration}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span>{game.spectators ? "Spectator Mode Supported" : "No Spectators"}</span>
                </div>
              </CardContent>
            </div>

            <div className="p-6 pt-0">
              <Link href={isGameImplemented(game.id as GameId) ? "/play" : "/games"}>
                <Button
                  className="w-full gap-2"
                  variant={isGameImplemented(game.id as GameId) ? "default" : "outline"}
                  disabled={!isGameImplemented(game.id as GameId)}
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{isGameImplemented(game.id as GameId) ? "Play" : "Coming soon"}</span>
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
