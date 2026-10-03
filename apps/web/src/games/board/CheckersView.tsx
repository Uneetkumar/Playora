"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, User, Sparkles, Volume2, VolumeX, Crown } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

export type PieceColor = "red" | "black";

export interface Piece {
  id: number;
  color: PieceColor;
  isKing: boolean;
}

export type Board = (Piece | null)[][]; // 8x8

export interface Move {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  jumpedRow?: number;
  jumpedCol?: number;
}

export function getMovesForCheckersPiece(
  currentBoard: Board,
  r: number,
  c: number,
  piece: Piece,
  onlyJumps = false
): Move[] {
  const moves: Move[] = [];
  const forwardDir = piece.color === "red" ? -1 : 1;
  const rowDirs = piece.isKing ? [-1, 1] : [forwardDir];
  const colDirs = [-1, 1];

  for (const rd of rowDirs) {
    for (const cd of colDirs) {
      // Jump capture
      const jr = r + rd * 2;
      const jc = c + cd * 2;
      const mr = r + rd;
      const mc = c + cd;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !currentBoard[jr]?.[jc]) {
        const midPiece = currentBoard[mr]?.[mc];
        if (midPiece && midPiece.color !== piece.color) {
          moves.push({
            fromRow: r,
            fromCol: c,
            toRow: jr,
            toCol: jc,
            jumpedRow: mr,
            jumpedCol: mc,
          });
        }
      }

      // Normal non-jump move
      if (!onlyJumps) {
        if (mr >= 0 && mr < 8 && mc >= 0 && mc < 8 && !currentBoard[mr]?.[mc]) {
          moves.push({ fromRow: r, fromCol: c, toRow: mr, toCol: mc });
        }
      }
    }
  }
  return moves;
}

export function shouldAutoContinueCheckersJump(
  board: Board,
  multiJumpSquare: [number, number] | null
): Move | null {
  if (!multiJumpSquare) return null;
  const [r, c] = multiJumpSquare;
  const piece = board[r]?.[c];
  if (!piece) return null;
  const jumps = getMovesForCheckersPiece(board, r, c, piece, true);
  if (jumps.length === 1) {
    return jumps[0] ?? null;
  }
  return null;
}

export function hasLegalCheckersMoves(board: Board, color: PieceColor): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (piece && piece.color === color) {
        const moves = getMovesForCheckersPiece(board, r, c, piece, false);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}

// Persistent audio context singleton
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function CheckersView({
  mode = "vs-ai",
  onExit,
}: {
  mode?: "vs-ai" | "pass-and-play";
  onExit?: () => void;
}) {
  const [board, setBoard] = React.useState<Board>(() => initBoard());
  const [turn, setTurn] = React.useState<PieceColor>("red");
  const [currentMode, setCurrentMode] = React.useState<"vs-ai" | "pass-and-play">(mode);

  React.useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);
  const [selectedSquare, setSelectedSquare] = React.useState<[number, number] | null>(null);
  const [winner, setWinner] = React.useState<PieceColor | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [multiJumpSquare, setMultiJumpSquare] = React.useState<[number, number] | null>(null);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  function initBoard(): Board {
    let idCounter = 1;
    const b: Board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          b[r]![c] = { id: idCounter++, color: "black", isKing: false };
        }
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          b[r]![c] = { id: idCounter++, color: "red", isKing: false };
        }
      }
    }
    return b;
  }

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "move" | "jump" | "king" | "win" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "move") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === "jump") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.16);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
          osc.start(now);
          osc.stop(now + 0.16);
        } else if (type === "king") {
          const notes = [440, 554.37, 659.25, 880];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
            noteGain.gain.setValueAtTime(0.18, now + idx * 0.08);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.08);
            noteOsc.stop(now + idx * 0.08 + 0.25);
          });
        } else if (type === "win") {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
            noteGain.gain.setValueAtTime(0.2, now + idx * 0.1);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.1);
            noteOsc.stop(now + idx * 0.1 + 0.3);
          });
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  // Check if player has any jumps available anywhere on the board
  const allPlayerMoves = React.useMemo(() => {
    if (multiJumpSquare) {
      const piece = board[multiJumpSquare[0]]?.[multiJumpSquare[1]];
      if (piece && piece.color === turn) {
        const pieceJumps = getMovesForCheckersPiece(board, multiJumpSquare[0], multiJumpSquare[1], piece, true);
        return { jumps: pieceJumps, regulars: [], hasJumps: true };
      }
      return { jumps: [], regulars: [], hasJumps: false };
    }
    const jumps: Move[] = [];
    const regulars: Move[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r]?.[c];
        if (piece && piece.color === turn) {
          const pieceMoves = getMovesForCheckersPiece(board, r, c, piece, false);
          for (const m of pieceMoves) {
            if (m.jumpedRow !== undefined) jumps.push(m);
            else regulars.push(m);
          }
        }
      }
    }
    // If jumps exist, mandatory jump rule applies!
    return { jumps, regulars, hasJumps: jumps.length > 0 };
  }, [board, turn, multiJumpSquare]);

  // Legal moves for currently selected square
  const legalMovesForSelected = React.useMemo(() => {
    if (!selectedSquare) return [];
    if (multiJumpSquare && (selectedSquare[0] !== multiJumpSquare[0] || selectedSquare[1] !== multiJumpSquare[1])) {
      return [];
    }
    const [r, c] = selectedSquare;
    const piece = board[r]?.[c];
    if (!piece || piece.color !== turn) return [];

    return getMovesForCheckersPiece(board, r, c, piece, allPlayerMoves.hasJumps);
  }, [board, selectedSquare, multiJumpSquare, turn, allPlayerMoves.hasJumps]);

  // Execute a move with multi-jump handling
  const executeMove = React.useCallback(
    (move: Move) => {
      const newBoard = board.map((row) => [...row]);
      const piece = newBoard[move.fromRow]![move.fromCol]!;

      newBoard[move.fromRow]![move.fromCol] = null;

      let becomesKing = piece.isKing;
      if (piece.color === "red" && move.toRow === 0) becomesKing = true;
      if (piece.color === "black" && move.toRow === 7) becomesKing = true;
      const newlyCrowned = becomesKing && !piece.isKing;

      const updatedPiece: Piece = {
        ...piece,
        isKing: becomesKing,
      };
      newBoard[move.toRow]![move.toCol] = updatedPiece;

      const wasJump = move.jumpedRow !== undefined && move.jumpedCol !== undefined;
      if (wasJump) {
        newBoard[move.jumpedRow!]![move.jumpedCol!] = null;
        playSound("jump");
      } else {
        playSound("move");
      }

      if (newlyCrowned) {
        playSound("king");
      }

      // Check if another jump is available from this new position for multi-jump
      // English / American draughts rules: When a piece reaches the king row, it is crowned and its turn ends immediately.
      const consecutiveJumps = wasJump && !newlyCrowned
        ? getMovesForCheckersPiece(newBoard, move.toRow, move.toCol, updatedPiece, true)
        : [];

      if (consecutiveJumps.length > 0) {
        setBoard(newBoard);
        setSelectedSquare([move.toRow, move.toCol]);
        setMultiJumpSquare([move.toRow, move.toCol]);
        return; // Turn continues!
      }

      setBoard(newBoard);
      setSelectedSquare(null);
      setMultiJumpSquare(null);

      // Win condition check: opponent has no pieces or no legal moves
      const nextTurn = turn === "red" ? "black" : "red";
      const opponentHasMoves = hasLegalCheckersMoves(newBoard, nextTurn);

      if (!opponentHasMoves) {
        setWinner(turn);
        playSound("win");
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          const duration = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
          saveLocalMatch({
            gameId: "checkers",
            gameName: "Checkers",
            mode: currentMode,
            outcome: currentMode === "vs-ai" ? (turn === "red" ? "win" : "loss") : "win",
            durationSeconds: duration,
            playedAt: Date.now(),
            score: turn === "red" ? 100 : 0,
          });
        }
        return;
      }

      setTurn(nextTurn);
    },
    [board, currentMode, playSound, turn]
  );

  // Multi-jump auto-continuation when only 1 jump option exists
  React.useEffect(() => {
    if (!multiJumpSquare || winner) return undefined;
    const isHumanTurn = currentMode === "pass-and-play" || turn === "red";
    if (!isHumanTurn) return undefined;

    const singleJump = shouldAutoContinueCheckersJump(board, multiJumpSquare);
    if (singleJump) {
      const timer = setTimeout(() => {
        executeMove(singleJump);
      }, 380);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [multiJumpSquare, winner, currentMode, turn, board, executeMove]);

  // Auto-select piece when only 1 piece has legal moves (e.g. single piece capable of mandatory jump)
  React.useEffect(() => {
    if (winner || multiJumpSquare) return;
    const isHumanTurn = currentMode === "pass-and-play" || turn === "red";
    if (!isHumanTurn) return;

    const movesPool = allPlayerMoves.hasJumps ? allPlayerMoves.jumps : allPlayerMoves.regulars;
    const uniqueFromPieces = new Map<string, [number, number]>();
    for (const m of movesPool) {
      const key = `${m.fromRow}-${m.fromCol}`;
      if (!uniqueFromPieces.has(key)) {
        uniqueFromPieces.set(key, [m.fromRow, m.fromCol]);
      }
    }
    if (uniqueFromPieces.size === 1) {
      const onlyPiece = Array.from(uniqueFromPieces.values())[0]!;
      setSelectedSquare(onlyPiece);
    }
  }, [turn, winner, multiJumpSquare, currentMode, allPlayerMoves]);

  // If active player has no moves left at all on their turn, opponent wins immediately
  React.useEffect(() => {
    if (winner || multiJumpSquare) return;
    const hasAnyMoves = allPlayerMoves.hasJumps || allPlayerMoves.regulars.length > 0;
    if (!hasAnyMoves) {
      const winningColor = turn === "red" ? "black" : "red";
      setWinner(winningColor);
      playSound("win");
      if (!matchRecordedRef.current) {
        matchRecordedRef.current = true;
        const duration = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
        saveLocalMatch({
          gameId: "checkers",
          gameName: "Checkers",
          mode: currentMode,
          outcome: currentMode === "vs-ai" ? (winningColor === "red" ? "win" : "loss") : "win",
          durationSeconds: duration,
          playedAt: Date.now(),
          score: winningColor === "red" ? 100 : 0,
        });
      }
    }
  }, [turn, winner, multiJumpSquare, allPlayerMoves, currentMode, playSound]);

  // AI Turn logic
  React.useEffect(() => {
    if (!(currentMode === "vs-ai" && turn === "black" && !winner)) return;
    setIsAiThinking(true);
    const timer = setTimeout(() => {
      let availablePool: Move[] = [];
      if (multiJumpSquare) {
        const piece = board[multiJumpSquare[0]]?.[multiJumpSquare[1]];
        if (piece && piece.color === "black") {
          availablePool = getMovesForCheckersPiece(board, multiJumpSquare[0], multiJumpSquare[1], piece, true);
        }
      } else {
        // Gather all legal moves for black
        const jumps: Move[] = [];
        const regulars: Move[] = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = board[r]?.[c];
            if (piece && piece.color === "black") {
              const pieceMoves = getMovesForCheckersPiece(board, r, c, piece, false);
              for (const m of pieceMoves) {
                if (m.jumpedRow !== undefined) jumps.push(m);
                else regulars.push(m);
              }
            }
          }
        }
        availablePool = jumps.length > 0 ? jumps : regulars;
      }

      if (availablePool.length === 0) {
        // Black has no legal moves -> Red wins
        setWinner("red");
        playSound("win");
        setIsAiThinking(false);
        return;
      }

      // Tactical AI: prioritize crowning moves, or central positions
      let chosen: Move;
      const jumps = availablePool.filter((m) => m.jumpedRow !== undefined);
      if (jumps.length > 0) {
        chosen = jumps[Math.floor(Math.random() * jumps.length)]!;
      } else {
        // Check if any move crowns a king (reaches row 7)
        const crownMove = availablePool.find((m) => m.toRow === 7);
        if (crownMove) {
          chosen = crownMove;
        } else {
          // Prefer moves advancing toward center
          const sorted = [...availablePool].sort((a, b) => {
            const distA = Math.abs(3.5 - a.toCol) + (7 - a.toRow);
            const distB = Math.abs(3.5 - b.toCol) + (7 - b.toRow);
            return distA - distB;
          });
          chosen = sorted[0]!;
        }
      }

      executeMove(chosen);
      setIsAiThinking(false);
    }, 480);

    return () => clearTimeout(timer);
  }, [board, turn, currentMode, winner, multiJumpSquare, executeMove, playSound]);

  const redPiecesCount = board.flat().filter((p) => p?.color === "red").length;
  const blackPiecesCount = board.flat().filter((p) => p?.color === "black").length;

  const resetGame = React.useCallback(() => {
    setBoard(initBoard());
    setTurn("red");
    setSelectedSquare(null);
    setMultiJumpSquare(null);
    setWinner(null);
    setIsAiThinking(false);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGame]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Checkers"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Control Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (winner ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Checkers</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              {currentMode === "vs-ai" ? "vs AI" : "2P Local"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode switch */}
          <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setCurrentMode("vs-ai");
                resetGame();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                currentMode === "vs-ai" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode("pass-and-play");
                resetGame();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-medium ${
                currentMode === "pass-and-play" ? "bg-primary text-white shadow" : "text-white/60 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">2P</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-white/40" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetGame}
            className="gap-1 text-xs border-white/15 hover:border-white/30 text-white/90"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Status HUD */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[min(92vw,calc(100dvh-130px),640px)] bg-white/[0.04] px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-4 w-4 rounded-full border border-white/20 ${
                turn === "red"
                  ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                  : "bg-zinc-800 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
              }`}
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Turn
              </div>
              <div className="text-sm font-black text-white capitalize flex items-center gap-2">
                <span>{turn === "red" ? "Red (Player)" : currentMode === "vs-ai" ? "Black (Bot)" : "Black (P2)"}</span>
                {multiJumpSquare && (
                  <span className="text-[11px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Combo Jump!
                  </span>
                )}
                {!multiJumpSquare && allPlayerMoves.hasJumps && (
                  <span className="text-[11px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Jump Required!
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
              Red: {redPiecesCount}
            </span>
            <span className="text-zinc-300 bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-700/40">
              Black: {blackPiecesCount}
            </span>
          </div>
        </div>

        {/* 8x8 Checkerboard */}
        <div className="relative aspect-square w-full max-w-[min(92vw,calc(100dvh-130px),640px)] bg-[#1a0f07] rounded-3xl p-2.5 sm:p-3 border-4 border-[#854d0e]/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <div className="grid grid-cols-8 grid-rows-8 h-full w-full rounded-2xl overflow-hidden border border-[#522504]">
            {board.map((row, r) =>
              row.map((piece, c) => {
                const isDark = (r + c) % 2 === 1;
                const isSelected = selectedSquare?.[0] === r && selectedSquare?.[1] === c;
                const legalMove = legalMovesForSelected.find(
                  (m) => m.toRow === r && m.toCol === c
                );
                const isHumanTurn = currentMode === "pass-and-play" || turn === "red";
                const pieceHasJump = Boolean(
                  allPlayerMoves.hasJumps &&
                    piece &&
                    piece.color === turn &&
                    allPlayerMoves.jumps.some((j) => j.fromRow === r && j.fromCol === c)
                );

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={(!piece && !legalMove) || isAiThinking || Boolean(winner) || !isHumanTurn}
                    onClick={() => {
                      if (!isHumanTurn || isAiThinking || Boolean(winner)) return;
                      if (legalMove) {
                        executeMove(legalMove);
                      } else if (!multiJumpSquare && piece && piece.color === turn) {
                        if (allPlayerMoves.hasJumps && !pieceHasJump) return;
                        setSelectedSquare([r, c]);
                        playSound("click");
                      }
                    }}
                    className={`relative flex items-center justify-center transition-all ${
                      isDark ? "bg-[#331c0e]" : "bg-[#c99f70]"
                    } ${isSelected ? "ring-4 ring-cyan-400 inset-0 z-20" : ""}`}
                  >
                    {/* Legal move indicator */}
                    {legalMove && (
                      <div className="h-4 w-4 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse" />
                    )}

                    {/* Piece */}
                    {piece && (
                      <div
                        className={`relative aspect-square w-[75%] rounded-full border-2 flex items-center justify-center shadow-lg transition-transform duration-200 ${
                          piece.color === "red"
                            ? "bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-300 shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
                            : "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border-zinc-500 shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
                        } ${
                          isSelected
                            ? "scale-110 ring-2 ring-white"
                            : pieceHasJump
                            ? "ring-2 ring-amber-400 animate-pulse hover:scale-105"
                            : "hover:scale-105"
                        }`}
                      >
                        {piece.isKing && (
                          <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Win Banner */}
        {winner && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="flex items-center gap-2 text-emerald-400 font-bold text-lg capitalize drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <Sparkles className="h-5 w-5" />
              {winner} Conquers the Board!
            </span>
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-red-500 to-amber-500 text-white font-bold">
              <RotateCcw className="h-4 w-4" />
              Play Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
