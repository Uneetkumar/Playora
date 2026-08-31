"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import { RopeRescueView } from "./RopeRescueView";
import { AntAttackView } from "./AntAttackView";
import { BombPassView } from "./BombPassView";
import { ColorRushView } from "./ColorRushView";
import { FallingFloorView } from "./FallingFloorView";
import { PinPuzzleView } from "./PinPuzzleView";
import { TargetRushView } from "./TargetRushView";
import { HotPotatoView } from "./HotPotatoView";
import { BridgeBuilderView } from "./BridgeBuilderView";
import { IceBreakerView } from "./IceBreakerView";

export function ArcadeGameView({
  gameId,
  onExit,
}: {
  gameId: GameId;
  onExit?: () => void;
}) {
  switch (gameId) {
    case "rope-rescue":
      return <RopeRescueView onExit={onExit} />;
    case "ant-attack":
      return <AntAttackView onExit={onExit} />;
    case "bomb-pass":
      return <BombPassView onExit={onExit} />;
    case "color-rush":
      return <ColorRushView onExit={onExit} />;
    case "falling-floor":
      return <FallingFloorView onExit={onExit} />;
    case "pin-puzzle":
      return <PinPuzzleView onExit={onExit} />;
    case "target-rush":
      return <TargetRushView onExit={onExit} />;
    case "hot-potato":
      return <HotPotatoView onExit={onExit} />;
    case "bridge-builder":
      return <BridgeBuilderView onExit={onExit} />;
    case "ice-breaker":
      return <IceBreakerView onExit={onExit} />;
    default:
      return null;
  }
}
