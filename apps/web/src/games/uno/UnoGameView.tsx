"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, cn } from "@playora/ui";
import {
  RotateCcw, Volume2, VolumeX,
  Settings, Copy, Check, ChevronDown,
} from "lucide-react";
import type { UnoCard, UnoColor, UnoPlayerView } from "@playora/game-engine";
import type { GameResult, Player } from "@playora/game-types";
import { COLOR_PALETTES } from "./UnoCardFace";
import {
  DrawDeck3D,
  DiscardPile3D,
  DirectionRing,
  SpatialPlayerPod,
  CurvedPlayerHand,
} from "./UnoTable";
import { useAudio } from "../../lib/audio/use-audio";

interface UnoGameViewProps {
  gameState: UnoPlayerView;
  players: Record<string, Player>;
  currentUserId: string;
  lastResult?: GameResult | null;
  onPlayCard: (cardId: string, chosenColor?: UnoColor, declareUno?: boolean) => void;
  onDrawCard: () => void;
  onPass: () => void;
  onRematch?: () => void;
  onExit?: () => void;
  isOpponentThinking?: boolean;
  noMercy?: boolean;
  roomCode?: string;
  mode?: string;
}

const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];

export function UnoGameView({
  gameState,
  players,
  currentUserId,
  onPlayCard,
  onDrawCard,
  onPass,
  onRematch,
  onExit,
  isOpponentThinking = false,
  noMercy = false,
  roomCode,
  mode = "Classic Match",
}: UnoGameViewProps) {
  const [pendingWild, setPendingWild] = React.useState<UnoCard | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [unoCalled, setUnoCalled] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(165); // ~02:45 default timer

  const play = useAudio();

  // Timer counter
  React.useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Sound effects
  const prevDiscardCount = React.useRef(gameState.discardPileCount);
  const prevHandCount = React.useRef(gameState.myHand.length);
  const prevTurn = React.useRef(gameState.isMyTurn);

  React.useEffect(() => {
    if (!muted) {
      if (gameState.discardPileCount > prevDiscardCount.current) play("card.play");
      else if (gameState.myHand.length > prevHandCount.current) play("card.draw");
      if (gameState.myHand.length === 1 && prevHandCount.current > 1) play("card.uno");
      if (gameState.isMyTurn && !prevTurn.current) play("match.turn");
    }
    prevDiscardCount.current = gameState.discardPileCount;
    prevHandCount.current = gameState.myHand.length;
    prevTurn.current = gameState.isMyTurn;
  }, [gameState.discardPileCount, gameState.myHand.length, gameState.isMyTurn, play, muted]);

  const playableSet = new Set(gameState.playableCardIds);
  const willBeUno = gameState.myHand.length === 2;

  const commitPlay = (cardId: string, color?: UnoColor) => {
    onPlayCard(cardId, color, willBeUno || unoCalled);
    setPendingWild(null);
    setUnoCalled(false);
  };

  const handleCardClick = (card: UnoCard) => {
    if (!gameState.isMyTurn || !playableSet.has(card.id)) return;
    if (card.color === null || card.value.startsWith("wild")) {
      setPendingWild(card);
      return;
    }
    commitPlay(card.id);
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Opponent Seats Distribution (up to 7 positions: top, top-left, mid-left, bot-left, top-right, mid-right, bot-right)
  const opps = gameState.opponents;
  const oppCount = opps.length;

  // Distribute opponents dynamically around table
  const topOpp = opps[0];
  const topLeftOpp = oppCount > 1 ? opps[1] : undefined;
  const midLeftOpp = oppCount > 2 ? opps[2] : undefined;
  const botLeftOpp = oppCount > 3 ? opps[3] : undefined;
  const topRightOpp = oppCount > 4 ? opps[4] : undefined;
  const midRightOpp = oppCount > 5 ? opps[5] : undefined;
  const botRightOpp = oppCount > 6 ? opps[6] : undefined;

  // Active color glow definition
  const activeColorHex =
    gameState.activeColor === "red"
      ? "#D72638"
      : gameState.activeColor === "yellow"
      ? "#F5B700"
      : gameState.activeColor === "green"
      ? "#2E933C"
      : gameState.activeColor === "blue"
      ? "#0C69D1"
      : noMercy
      ? "#FF4500"
      : "#6366F1";

  // Active player information
  const activeId = gameState.activePlayerId ?? "";
  const isMe = activeId === currentUserId;
  const activeOpp = !isMe ? opps.find((o) => o.playerId === activeId) : null;
  const activePlayerName = isMe
    ? "You"
    : players[activeId]?.displayName ?? activeOpp?.playerId?.slice(0, 8) ?? "Opponent";
  const activePlayerCardCount = isMe ? gameState.myHand.length : activeOpp?.cardCount ?? 0;

  return (
    <div
      className={cn(
        "relative flex h-full w-full select-none overflow-hidden font-sans",
        noMercy ? "bg-[#090303]" : "bg-[#060914]"
      )}
    >
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. BACKGROUND GLOW & STARFIELD TEXTURE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: noMercy
            ? "radial-gradient(ellipse 90% 75% at 50% 45%, rgba(180, 20, 10, 0.45) 0%, rgba(60, 5, 5, 0.25) 50%, transparent 100%)"
            : "radial-gradient(ellipse 90% 75% at 50% 45%, rgba(30, 45, 110, 0.55) 0%, rgba(10, 18, 45, 0.3) 50%, transparent 100%)",
        }}
      />

      {/* Dynamic Active-Color Pulsing Core Glow */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          opacity: [0.55, 0.85, 0.55],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(circle 320px at 50% 46%, ${activeColorHex}44 0%, transparent 75%)`,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN TABLE AREA */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* TOP BAR CONTROLS */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-3">
          <div className="flex items-center gap-3">
            {/* Mode Pill */}
            <button
              type="button"
              onClick={onExit}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black tracking-wider border shadow-md transition-transform hover:scale-105",
                noMercy
                  ? "border-orange-500/50 bg-orange-950/80 text-orange-400"
                  : "border-white/15 bg-slate-900/80 text-white"
              )}
            >
              <span>{noMercy ? "NO MERCY" : "CLASSIC"}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {/* Match Timer */}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm">
              <span className="text-white/40">⏱</span>
              <span className="tabular-nums font-mono">{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="rounded-lg border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white transition-colors"
              aria-label="Toggle Audio"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            {/* Settings */}
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* SPATIAL SEATS & POKER TABLE SURFACE */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="relative flex flex-1 items-center justify-center">
          {/* OVAL FELT TABLE BORDER & SURFACE */}
          <div
            className="absolute h-[74%] w-[86%] rounded-[50%] border"
            style={{
              borderColor: noMercy ? "rgba(255, 69, 0, 0.25)" : "rgba(99, 102, 241, 0.25)",
              background: noMercy
                ? "radial-gradient(ellipse 90% 80% at 50% 50%, #2A0909 0%, #150303 60%, #080101 100%)"
                : "radial-gradient(ellipse 90% 80% at 50% 50%, #0E1A38 0%, #091024 60%, #040712 100%)",
              boxShadow: noMercy
                ? "inset 0 0 60px rgba(0,0,0,0.9), 0 0 40px rgba(255, 69, 0, 0.2)"
                : "inset 0 0 60px rgba(0,0,0,0.9), 0 0 40px rgba(99, 102, 241, 0.2)",
            }}
          />

          {/* TABLE CENTER: Direction Ring & 3D Cards */}
          <div className="relative z-10 flex items-center justify-center">
            {/* Rotating glowing direction ring */}
            <DirectionRing direction={gameState.direction} noMercy={noMercy} />

            {/* 3D Piles */}
            <div className="relative z-20 flex items-center gap-10">
              {/* 3D Draw Deck */}
              <DrawDeck3D
                count={gameState.drawPileCount}
                pendingDraw={gameState.pendingDraw}
                onDraw={onDrawCard}
                disabled={!gameState.isMyTurn}
                noMercy={noMercy}
              />

              {/* 3D Discard Pile */}
              <DiscardPile3D
                cards={gameState.topCard ? [gameState.topCard] : []}
                activeColor={gameState.activeColor}
                noMercy={noMercy}
              />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SEATED PLAYERS AROUND OVAL RING */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {/* Top Center Player (e.g. Sophia) */}
          {topOpp && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
              <SpatialPlayerPod
                name={players[topOpp.playerId]?.displayName ?? "Sophia"}
                cardCount={topOpp.cardCount}
                isActive={topOpp.playerId === activeId}
                hasCalledUno={topOpp.hasCalledUno}
                noMercy={noMercy}
                position="top"
              />
            </div>
          )}

          {/* Top-Left Player (Liam) */}
          {topLeftOpp && (
            <div className="absolute top-[16%] left-[6%] z-20">
              <SpatialPlayerPod
                name={players[topLeftOpp.playerId]?.displayName ?? "Liam"}
                cardCount={topLeftOpp.cardCount}
                isActive={topLeftOpp.playerId === activeId}
                hasCalledUno={topLeftOpp.hasCalledUno}
                noMercy={noMercy}
                position="top-left"
              />
            </div>
          )}

          {/* Mid-Left Player (Emma) */}
          {midLeftOpp && (
            <div className="absolute top-[44%] left-[4%] z-20">
              <SpatialPlayerPod
                name={players[midLeftOpp.playerId]?.displayName ?? "Emma"}
                cardCount={midLeftOpp.cardCount}
                isActive={midLeftOpp.playerId === activeId}
                hasCalledUno={midLeftOpp.hasCalledUno}
                noMercy={noMercy}
                position="mid-left"
              />
            </div>
          )}

          {/* Bottom-Left Player (William) */}
          {botLeftOpp && (
            <div className="absolute bottom-[16%] left-[8%] z-20">
              <SpatialPlayerPod
                name={players[botLeftOpp.playerId]?.displayName ?? "William"}
                cardCount={botLeftOpp.cardCount}
                isActive={botLeftOpp.playerId === activeId}
                hasCalledUno={botLeftOpp.hasCalledUno}
                noMercy={noMercy}
                position="bot-left"
              />
            </div>
          )}

          {/* Top-Right Player (Noah) */}
          {topRightOpp && (
            <div className="absolute top-[16%] right-[6%] z-20">
              <SpatialPlayerPod
                name={players[topRightOpp.playerId]?.displayName ?? "Noah"}
                cardCount={topRightOpp.cardCount}
                isActive={topRightOpp.playerId === activeId}
                hasCalledUno={topRightOpp.hasCalledUno}
                noMercy={noMercy}
                position="top-right"
              />
            </div>
          )}

          {/* Mid-Right Player (Olivia) */}
          {midRightOpp && (
            <div className="absolute top-[44%] right-[4%] z-20">
              <SpatialPlayerPod
                name={players[midRightOpp.playerId]?.displayName ?? "Olivia"}
                cardCount={midRightOpp.cardCount}
                isActive={midRightOpp.playerId === activeId}
                hasCalledUno={midRightOpp.hasCalledUno}
                noMercy={noMercy}
                position="mid-right"
              />
            </div>
          )}

          {/* Bottom-Right Player (Ava) */}
          {botRightOpp && (
            <div className="absolute bottom-[16%] right-[8%] z-20">
              <SpatialPlayerPod
                name={players[botRightOpp.playerId]?.displayName ?? "Ava"}
                cardCount={botRightOpp.cardCount}
                isActive={botRightOpp.playerId === activeId}
                hasCalledUno={botRightOpp.hasCalledUno}
                noMercy={noMercy}
                position="bot-right"
              />
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* BOTTOM SECTION: "You" Label, Curved Hand & Glowing UNO Button */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="relative z-30 pb-4">
          <div className="flex flex-col items-center">
            {/* "You" Tag & Turn Status */}
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-white/50">
                You
              </span>
              {gameState.isMyTurn && (
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                    noMercy ? "bg-orange-600 text-white" : "bg-emerald-600 text-white"
                  )}
                >
                  Your Turn
                </motion.span>
              )}
              {gameState.hasDrawn && gameState.isMyTurn && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2.5 text-[11px] border-white/20 text-white/80"
                  onClick={onPass}
                >
                  Pass Turn
                </Button>
              )}
            </div>

            {/* CURVED FAN OF CARDS */}
            <CurvedPlayerHand
              cards={gameState.myHand}
              playableIds={playableSet}
              onCardClick={handleCardClick}
              isMyTurn={gameState.isMyTurn}
              noMercy={noMercy}
            />
          </div>

          {/* 3D Glowing UNO Button at Bottom Left */}
          <div className="absolute bottom-6 left-6 z-40">
            <motion.button
              type="button"
              onClick={() => setUnoCalled(true)}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.94 }}
              disabled={gameState.myHand.length > 2}
              className={cn(
                "group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-400 select-none shadow-2xl transition-all",
                gameState.myHand.length <= 2
                  ? "cursor-pointer bg-gradient-to-tr from-red-700 via-red-600 to-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)] animate-pulse"
                  : "cursor-not-allowed bg-red-950/60 opacity-60 border-yellow-500/40"
              )}
            >
              <span
                className="font-display font-black italic text-yellow-300 text-base tracking-tight"
                style={{
                  textShadow: "0 2px 4px #000",
                }}
              >
                UNO
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. RIGHT SIDEBAR (Game Info & Current Player) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "hidden w-64 shrink-0 flex-col gap-4 border-l p-5 backdrop-blur-md lg:flex",
          noMercy
            ? "border-orange-900/30 bg-black/60"
            : "border-indigo-900/30 bg-[#080D1D]/70"
        )}
      >
        {/* GAME INFO CARD */}
        <div
          className={cn(
            "rounded-2xl border p-4 shadow-xl",
            noMercy
              ? "border-orange-700/30 bg-orange-950/20"
              : "border-indigo-500/20 bg-indigo-950/20"
          )}
        >
          <h4
            className={cn(
              "text-[11px] font-black uppercase tracking-widest mb-3",
              noMercy ? "text-orange-400" : "text-indigo-400"
            )}
          >
            GAME INFO
          </h4>

          {/* Room Code */}
          {roomCode && (
            <div className="mb-3.5">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Room Code
              </span>
              <div className="mt-1 flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 border border-white/5">
                <span className="font-mono text-base font-black tracking-widest text-white">
                  {roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-white/50 hover:text-white transition-colors"
                  aria-label="Copy Code"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Game Name */}
          <div className="mb-2.5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Game
            </span>
            <p className="text-xs font-bold text-white mt-0.5">
              {noMercy ? "UNO Reverse (No Mercy)" : "UNO Classic"}
            </p>
          </div>

          {/* Mode */}
          <div className="mb-2.5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Mode
            </span>
            <p className="text-xs font-bold text-white mt-0.5">
              {oppCount > 0 ? `${oppCount + 1} Players` : mode}
            </p>
          </div>

          {/* Objective */}
          <div>
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Objective
            </span>
            <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
              Be the first to get rid of all cards in your hand.
            </p>
          </div>
        </div>

        {/* CURRENT PLAYER CARD */}
        <div
          className={cn(
            "rounded-2xl border p-4 shadow-xl",
            noMercy
              ? "border-orange-700/30 bg-orange-950/20"
              : "border-indigo-500/20 bg-indigo-950/20"
          )}
        >
          <h4
            className={cn(
              "text-[11px] font-black uppercase tracking-widest mb-3",
              noMercy ? "text-orange-400" : "text-indigo-400"
            )}
          >
            CURRENT PLAYER
          </h4>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-full p-0.5",
                isMe
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                  : "bg-gradient-to-r from-blue-400 to-indigo-500"
              )}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 font-display font-bold text-sm text-white">
                {activePlayerName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div>
              <p className="font-bold text-sm text-white">{activePlayerName}</p>
              <p className="text-xs text-white/50">{activePlayerCardCount} Cards</p>
            </div>
          </div>

          <div className="mt-3">
            <span
              className={cn(
                "text-xs font-black",
                isMe
                  ? noMercy
                    ? "text-orange-400 animate-pulse"
                    : "text-emerald-400 animate-pulse"
                  : "text-white/40"
              )}
            >
              {isMe ? "It's your turn!" : isOpponentThinking ? "Thinking..." : "Waiting for move..."}
            </span>
          </div>
        </div>

        {/* ACTIVE COLOR TO PLAY CARD */}
        {gameState.activeColor && (
          <div
            className={cn(
              "rounded-2xl border p-3.5 shadow-xl transition-all",
              noMercy
                ? "border-orange-700/30 bg-orange-950/20"
                : "border-indigo-500/20 bg-indigo-950/20"
            )}
          >
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2">
              Color in Play
            </span>
            <div
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 border shadow-lg"
              style={{
                background:
                  gameState.activeColor === "red"
                    ? "rgba(215, 38, 56, 0.25)"
                    : gameState.activeColor === "yellow"
                    ? "rgba(245, 183, 0, 0.25)"
                    : gameState.activeColor === "green"
                    ? "rgba(46, 147, 60, 0.25)"
                    : "rgba(12, 105, 209, 0.25)",
                borderColor:
                  gameState.activeColor === "red"
                    ? "#FF4D5E"
                    : gameState.activeColor === "yellow"
                    ? "#FFD447"
                    : gameState.activeColor === "green"
                    ? "#4BD15D"
                    : "#3B92F5",
              }}
            >
              <span
                className="h-4 w-4 rounded-full shadow-md animate-pulse"
                style={{
                  background:
                    gameState.activeColor === "red"
                      ? "#D72638"
                      : gameState.activeColor === "yellow"
                      ? "#F5B700"
                      : gameState.activeColor === "green"
                      ? "#2E933C"
                      : "#0C69D1",
                  boxShadow: `0 0 10px ${
                    gameState.activeColor === "red"
                      ? "#D72638"
                      : gameState.activeColor === "yellow"
                      ? "#F5B700"
                      : gameState.activeColor === "green"
                      ? "#2E933C"
                      : "#0C69D1"
                  }`,
                }}
              />
              <span
                className="font-display text-xs font-black uppercase tracking-wider"
                style={{
                  color:
                    gameState.activeColor === "yellow"
                      ? "#FFE066"
                      : "#FFFFFF",
                }}
              >
                {gameState.activeColor}
              </span>
            </div>
          </div>
        )}

        {/* Rematch Button if Finished */}
        {gameState.isFinished && onRematch && (
          <Button
            className={cn(
              "w-full gap-2 text-sm font-bold shadow-xl",
              noMercy ? "bg-orange-600 hover:bg-orange-500" : "bg-indigo-600 hover:bg-indigo-500"
            )}
            onClick={onRematch}
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. WILD COLOR CHOOSER MODAL OVERLAY */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingWild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className={cn(
                "w-80 rounded-3xl border p-6 text-center shadow-2xl",
                noMercy ? "border-orange-500/40 bg-[#160505]" : "border-indigo-500/40 bg-[#0A0F24]"
              )}
            >
              <h3 className="font-display text-xl font-black text-white tracking-wide">
                Choose Color
              </h3>
              <p className="text-xs text-white/50 mt-1">Select the active color to continue</p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                {COLORS.map((col) => {
                  const palette = noMercy ? COLOR_PALETTES.noMercy[col] : COLOR_PALETTES.classic[col];
                  return (
                    <motion.button
                      key={col}
                      type="button"
                      onClick={() => commitPlay(pendingWild.id, col)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex h-16 items-center justify-center rounded-2xl border-2 border-white/20 shadow-lg text-white font-black text-sm uppercase tracking-wider"
                      style={{
                        background: `linear-gradient(135deg, ${palette.light}, ${palette.main})`,
                        boxShadow: `0 0 20px ${palette.main}88`,
                      }}
                    >
                      {col}
                    </motion.button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-5 text-xs text-white/50 hover:text-white"
                onClick={() => setPendingWild(null)}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
