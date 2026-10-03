/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { checkTicTacToeWinner, getTicTacToeEmptyIndices } from "../TicTacToeView";
import { checkConnectFourWin, getConnectFourOpenRow } from "../ConnectFourView";
import {
  getMovesForCheckersPiece,
  shouldAutoContinueCheckersJump,
  hasLegalCheckersMoves,
  type Board as CheckersBoard,
  type Piece as CheckersPiece,
} from "../CheckersView";
import {
  getLudoTokenCoords,
  COLOR_START_INDEX,
  YARD_COORDS_SVG,
  TRACK_COORDS,
  getMovableLudoTokens,
  shouldAutoMoveLudoToken,
  type LudoToken,
} from "../LudoView";
import {
  getSnakeLadderCoordinates,
  calculateSnakeLadderMove,
  LADDERS,
  SNAKES,
} from "../SnakeLadderView";
import {
  validateShipPlacement,
  checkBattleshipFleetSunk,
  type PlacedShip,
  type ShotStatus,
} from "../BattleshipView";
import { calculatePongPaddleBounce } from "../PongView";
import {
  checkMemoryCardsMatch,
  applyFastForwardMismatch,
  type MemoryCard,
} from "../MemoryMatchView";

describe("Board Games Logic", () => {
  describe("Tic-Tac-Toe checkTicTacToeWinner", () => {
    it("detects a horizontal row win", () => {
      const board = [
        "X", "X", "X",
        null, "O", null,
        "O", null, null,
      ];
      const result = checkTicTacToeWinner(board as any);
      expect(result.winner).toBe("X");
      expect(result.line).toEqual([0, 1, 2]);
    });

    it("detects a vertical column win", () => {
      const board = [
        "O", "X", null,
        "O", "X", null,
        "O", null, "X",
      ];
      const result = checkTicTacToeWinner(board as any);
      expect(result.winner).toBe("O");
      expect(result.line).toEqual([0, 3, 6]);
    });

    it("detects a diagonal win", () => {
      const board = [
        "X", "O", null,
        "O", "X", null,
        null, "O", "X",
      ];
      const result = checkTicTacToeWinner(board as any);
      expect(result.winner).toBe("X");
      expect(result.line).toEqual([0, 4, 8]);
    });

    it("returns null when no three-in-a-row is present", () => {
      const board = [
        "X", "O", "X",
        "X", "O", "O",
        "O", "X", "X",
      ];
      const result = checkTicTacToeWinner(board as any);
      expect(result.winner).toBeNull();
      expect(result.line).toBeNull();
    });

    it("identifies single remaining square for auto-finish flow", () => {
      const board = [
        "X", "O", "X",
        "X", "O", "O",
        "O", "X", null,
      ];
      const empty = getTicTacToeEmptyIndices(board as any);
      expect(empty).toEqual([8]);
    });
  });

  describe("Connect Four checkConnectFourWin & getConnectFourOpenRow", () => {
    const createEmptyBoard = () =>
      Array(6).fill(null).map(() => Array(7).fill(null));

    it("finds lowest open row correctly", () => {
      const board = createEmptyBoard();
      expect(getConnectFourOpenRow(board as any, 3)).toBe(5);

      board[5]![3] = "red";
      expect(getConnectFourOpenRow(board as any, 3)).toBe(4);

      board[4]![3] = "yellow";
      board[3]![3] = "red";
      board[2]![3] = "yellow";
      board[1]![3] = "red";
      board[0]![3] = "yellow";
      expect(getConnectFourOpenRow(board as any, 3)).toBe(-1); // column is full
    });

    it("detects horizontal 4-in-a-row", () => {
      const board = createEmptyBoard();
      board[5]![1] = "red";
      board[5]![2] = "red";
      board[5]![3] = "red";
      board[5]![4] = "red";

      const win = checkConnectFourWin(board as any, 5, 4, "red");
      expect(win).not.toBeNull();
      expect(win).toHaveLength(4);
    });

    it("detects vertical 4-in-a-row", () => {
      const board = createEmptyBoard();
      board[5]![0] = "yellow";
      board[4]![0] = "yellow";
      board[3]![0] = "yellow";
      board[2]![0] = "yellow";

      const win = checkConnectFourWin(board as any, 2, 0, "yellow");
      expect(win).not.toBeNull();
      expect(win).toHaveLength(4);
    });

    it("detects diagonal 4-in-a-row", () => {
      const board = createEmptyBoard();
      board[5]![0] = "red";
      board[4]![1] = "red";
      board[3]![2] = "red";
      board[2]![3] = "red";

      const win = checkConnectFourWin(board as any, 2, 3, "red");
      expect(win).not.toBeNull();
      expect(win).toHaveLength(4);
    });

    it("returns null when only 3 discs are connected", () => {
      const board = createEmptyBoard();
      board[5]![0] = "red";
      board[5]![1] = "red";
      board[5]![2] = "red";

      const win = checkConnectFourWin(board as any, 5, 2, "red");
      expect(win).toBeNull();
    });
  });

  describe("Ludo Board Geometry & Navigation", () => {
    it("returns correct SVG yard coordinates for initial tokens (step -1)", () => {
      expect(getLudoTokenCoords({ id: 0, color: "red", step: -1 })).toEqual(YARD_COORDS_SVG.red[0]);
      expect(getLudoTokenCoords({ id: 1, color: "red", step: -1 })).toEqual(YARD_COORDS_SVG.red[1]);
      expect(getLudoTokenCoords({ id: 0, color: "green", step: -1 })).toEqual(YARD_COORDS_SVG.green[0]);
      expect(getLudoTokenCoords({ id: 0, color: "yellow", step: -1 })).toEqual(YARD_COORDS_SVG.yellow[0]);
      expect(getLudoTokenCoords({ id: 0, color: "blue", step: -1 })).toEqual(YARD_COORDS_SVG.blue[0]);
    });

    it("places finished tokens (step 56) in their respective home triangle quadrants", () => {
      expect(getLudoTokenCoords({ id: 0, color: "red", step: 56 })).toEqual([68, 75]);
      expect(getLudoTokenCoords({ id: 0, color: "green", step: 56 })).toEqual([75, 68]);
      expect(getLudoTokenCoords({ id: 0, color: "yellow", step: 56 })).toEqual([82, 75]);
      expect(getLudoTokenCoords({ id: 0, color: "blue", step: 56 })).toEqual([75, 82]);
    });

    it("verifies starting track coords correspond to correct color offsets", () => {
      expect(COLOR_START_INDEX.red).toBe(0);
      expect(COLOR_START_INDEX.green).toBe(13);
      expect(COLOR_START_INDEX.yellow).toBe(26);
      expect(COLOR_START_INDEX.blue).toBe(39);

      // Red start step 0
      const redStart = getLudoTokenCoords({ id: 0, color: "red", step: 0 });
      const redGridCell = TRACK_COORDS[0]!;
      expect(redStart).toEqual([redGridCell[1] * 10 + 5, redGridCell[0] * 10 + 5]);
    });

    it("auto-moves when only one goti is open on the track and roll is 1..5", () => {
      const tokens: LudoToken[] = [
        { id: 0, color: "red", step: 10 },
        { id: 1, color: "red", step: -1 },
        { id: 2, color: "red", step: -1 },
        { id: 3, color: "red", step: -1 },
      ];

      const movable = getMovableLudoTokens(tokens, "red", 3);
      expect(movable).toHaveLength(1);
      expect(movable[0]!.id).toBe(0);

      const autoTarget = shouldAutoMoveLudoToken(movable);
      expect(autoTarget).toBeDefined();
      expect(autoTarget?.id).toBe(0);
    });

    it("gives player choice when one goti is open and dice is 6 (can advance or open new goti)", () => {
      const tokens: LudoToken[] = [
        { id: 0, color: "red", step: 10 },
        { id: 1, color: "red", step: -1 },
        { id: 2, color: "red", step: -1 },
        { id: 3, color: "red", step: -1 },
      ];

      const movable = getMovableLudoTokens(tokens, "red", 6);
      expect(movable.length).toBeGreaterThan(1);
      // Because there is a meaningful choice between track advance and yard release:
      const autoTarget = shouldAutoMoveLudoToken(movable);
      expect(autoTarget).toBeNull();
    });

    it("auto-releases token when all movable tokens are in the yard and roll is 6", () => {
      const tokens: LudoToken[] = [
        { id: 0, color: "red", step: -1 },
        { id: 1, color: "red", step: -1 },
        { id: 2, color: "red", step: -1 },
        { id: 3, color: "red", step: -1 },
      ];

      const movable = getMovableLudoTokens(tokens, "red", 6);
      expect(movable).toHaveLength(4);
      // All tokens are identical yard tokens; auto-select first to avoid redundant click
      const autoTarget = shouldAutoMoveLudoToken(movable);
      expect(autoTarget).toBeDefined();
      expect(autoTarget?.id).toBe(0);
    });

    it("returns empty movable tokens when all tokens in yard and roll is not 6", () => {
      const tokens: LudoToken[] = [
        { id: 0, color: "red", step: -1 },
        { id: 1, color: "red", step: -1 },
        { id: 2, color: "red", step: -1 },
        { id: 3, color: "red", step: -1 },
      ];

      const movable = getMovableLudoTokens(tokens, "red", 4);
      expect(movable).toHaveLength(0);
      expect(shouldAutoMoveLudoToken(movable)).toBeNull();
    });

    it("auto-moves when only one token can move without overshooting home", () => {
      const tokens: LudoToken[] = [
        { id: 0, color: "red", step: 54 }, // 54 + 4 = 58 > 56 (overshoot, cannot move)
        { id: 1, color: "red", step: 20 }, // 20 + 4 = 24 <= 56 (valid)
        { id: 2, color: "red", step: -1 }, // yard, roll 4 cannot move
        { id: 3, color: "red", step: 56 }, // already finished
      ];

      const movable = getMovableLudoTokens(tokens, "red", 4);
      expect(movable).toHaveLength(1);
      expect(movable[0]!.id).toBe(1);

      const autoTarget = shouldAutoMoveLudoToken(movable);
      expect(autoTarget?.id).toBe(1);
    });
  });

  describe("Snakes & Ladders Grid Coordinates & Path Logic", () => {
    it("maps square 1 to bottom-left (5, 95) and square 100 to top-left (5, 5)", () => {
      const sq1 = getSnakeLadderCoordinates(1);
      expect(sq1).toEqual({ x: 5, y: 95 });

      const sq10 = getSnakeLadderCoordinates(10);
      expect(sq10).toEqual({ x: 95, y: 95 });

      const sq11 = getSnakeLadderCoordinates(11);
      expect(sq11).toEqual({ x: 95, y: 85 }); // boustrophedon zigzag moves left

      const sq100 = getSnakeLadderCoordinates(100);
      expect(sq100).toEqual({ x: 5, y: 5 });
    });

    it("verifies all ladders advance forward and snakes move backward", () => {
      Object.entries(LADDERS).forEach(([bottom, top]) => {
        expect(Number(top)).toBeGreaterThan(Number(bottom));
      });

      Object.entries(SNAKES).forEach(([head, tail]) => {
        expect(Number(tail)).toBeLessThan(Number(head));
      });
    });

    it("calculates regular moves without snakes or ladders", () => {
      const move = calculateSnakeLadderMove(1, 2); // 1 + 2 = 3
      expect(move.intermediatePos).toBe(3);
      expect(move.targetPos).toBe(3);
      expect(move.isLadder).toBe(false);
      expect(move.isSnake).toBe(false);
      expect(move.exceedsBoard).toBe(false);
    });

    it("detects ladder climbs from intermediate tile to top", () => {
      const move = calculateSnakeLadderMove(1, 3); // lands on 4, ladder to 14
      expect(move.intermediatePos).toBe(4);
      expect(move.targetPos).toBe(14);
      expect(move.isLadder).toBe(true);
      expect(move.isSnake).toBe(false);
    });

    it("detects snake bites from intermediate tile down to tail", () => {
      const move = calculateSnakeLadderMove(14, 3); // lands on 17, snake to 7
      expect(move.intermediatePos).toBe(17);
      expect(move.targetPos).toBe(7);
      expect(move.isLadder).toBe(false);
      expect(move.isSnake).toBe(true);
    });

    it("rejects rolls that overshoot tile 100", () => {
      const move = calculateSnakeLadderMove(97, 5); // 97 + 5 = 102 > 100
      expect(move.exceedsBoard).toBe(true);
      expect(move.targetPos).toBe(97); // stays at original
    });

    it("validates exact rolls winning at square 100", () => {
      const move = calculateSnakeLadderMove(96, 4); // 96 + 4 = 100
      expect(move.exceedsBoard).toBe(false);
      expect(move.targetPos).toBe(100);
    });
  });

  describe("Checkers Legal Moves & Multi-Jump Auto-Continuation", () => {
    const createEmptyCheckersBoard = (): CheckersBoard =>
      Array(8).fill(null).map(() => Array(8).fill(null));

    it("generates forward diagonal moves for standard pieces", () => {
      const b = createEmptyCheckersBoard();
      const redPiece: CheckersPiece = { id: 1, color: "red", isKing: false };
      b[5]![2] = redPiece;

      const moves = getMovesForCheckersPiece(b, 5, 2, redPiece, false);
      expect(moves).toHaveLength(2);
      expect(moves.map((m) => [m.toRow, m.toCol])).toEqual([
        [4, 1],
        [4, 3],
      ]);
    });

    it("detects jump capture over opposing piece", () => {
      const b = createEmptyCheckersBoard();
      const redPiece: CheckersPiece = { id: 1, color: "red", isKing: false };
      const blackPiece: CheckersPiece = { id: 2, color: "black", isKing: false };
      b[5]![2] = redPiece;
      b[4]![3] = blackPiece;

      // When onlyJumps is false, it returns the jump AND the other legal regular move (4, 1)
      const moves = getMovesForCheckersPiece(b, 5, 2, redPiece, false);
      const jump = moves.find((m) => m.jumpedRow !== undefined);
      expect(jump).toBeDefined();
      expect(jump?.toRow).toBe(3);
      expect(jump?.toCol).toBe(4);
      expect(jump?.jumpedRow).toBe(4);
      expect(jump?.jumpedCol).toBe(3);

      // When onlyJumps is true (mandatory jump rule), only jump moves are returned
      const mandatoryMoves = getMovesForCheckersPiece(b, 5, 2, redPiece, true);
      expect(mandatoryMoves).toHaveLength(1);
      expect(mandatoryMoves[0]?.toRow).toBe(3);
      expect(mandatoryMoves[0]?.toCol).toBe(4);
    });

    it("auto-continues multi-jump when exactly one jump continuation exists", () => {
      const b = createEmptyCheckersBoard();
      const redPiece: CheckersPiece = { id: 1, color: "red", isKing: false };
      const blackPiece: CheckersPiece = { id: 2, color: "black", isKing: false };
      // Red landed on [4, 4], enemy is at [3, 3], landing at [2, 2] is free
      b[4]![4] = redPiece;
      b[3]![3] = blackPiece;

      const nextJump = shouldAutoContinueCheckersJump(b, [4, 4]);
      expect(nextJump).not.toBeNull();
      expect(nextJump?.toRow).toBe(2);
      expect(nextJump?.toCol).toBe(2);
    });

    it("does not auto-continue when branching multi-jump choices exist", () => {
      const b = createEmptyCheckersBoard();
      const redKing: CheckersPiece = { id: 1, color: "red", isKing: true };
      const black1: CheckersPiece = { id: 2, color: "black", isKing: false };
      const black2: CheckersPiece = { id: 3, color: "black", isKing: false };
      // King at [4, 4] with two jump targets: [3, 3] -> [2, 2] AND [3, 5] -> [2, 6]
      b[4]![4] = redKing;
      b[3]![3] = black1;
      b[3]![5] = black2;

      const nextJump = shouldAutoContinueCheckersJump(b, [4, 4]);
      // Branching decision: player must choose which enemy to capture
      expect(nextJump).toBeNull();
    });

    it("returns null when no jump continuations exist from multiJumpSquare", () => {
      const b = createEmptyCheckersBoard();
      const redPiece: CheckersPiece = { id: 1, color: "red", isKing: false };
      b[4]![4] = redPiece;

      const nextJump = shouldAutoContinueCheckersJump(b, [4, 4]);
      expect(nextJump).toBeNull();
    });

    it("accurately detects when a player has legal moves vs is trapped with 0 moves", () => {
      const b = createEmptyCheckersBoard();
      const redPiece: CheckersPiece = { id: 1, color: "red", isKing: false };
      // Red piece placed at [0, 1] - regular piece moving up (-1) is at the edge and cannot move forward
      b[0]![1] = redPiece;
      expect(hasLegalCheckersMoves(b, "red")).toBe(false);

      // Trapped piece scenario: Red at [7, 0], blocked by Black at [6, 1], with [5, 2] occupied by another Black
      const b2 = createEmptyCheckersBoard();
      b2[7]![0] = { id: 1, color: "red", isKing: false };
      b2[6]![1] = { id: 2, color: "black", isKing: false };
      b2[5]![2] = { id: 3, color: "black", isKing: false }; // Blocks jump landing
      expect(hasLegalCheckersMoves(b2, "red")).toBe(false);

      // If landing square [5, 2] is emptied, jump becomes legal
      b2[5]![2] = null;
      expect(hasLegalCheckersMoves(b2, "red")).toBe(true);
    });
  });

  describe("Battleship Placement & Attack Validation", () => {
    it("validates horizontal and vertical ship placement within grid bounds", () => {
      const resHoriz = validateShipPlacement(10, 4, 2, 3, "horizontal", []);
      expect(resHoriz.valid).toBe(true);
      expect(resHoriz.cells).toEqual([
        [2, 3],
        [2, 4],
        [2, 5],
        [2, 6],
      ]);

      const resVert = validateShipPlacement(10, 3, 5, 2, "vertical", []);
      expect(resVert.valid).toBe(true);
      expect(resVert.cells).toEqual([
        [5, 2],
        [6, 2],
        [7, 2],
      ]);
    });

    it("rejects placements that exceed grid bounds", () => {
      const outRight = validateShipPlacement(10, 4, 0, 7, "horizontal", []);
      expect(outRight.valid).toBe(false);

      const outBottom = validateShipPlacement(10, 5, 6, 0, "vertical", []);
      expect(outBottom.valid).toBe(false);
    });

    it("detects ship cell collisions with existing fleet", () => {
      const existing: PlacedShip[] = [
        { id: "s1", name: "Ship 1", size: 3, cells: [[2, 2], [2, 3], [2, 4]] },
      ];

      const colliding = validateShipPlacement(10, 3, 1, 3, "vertical", existing);
      expect(colliding.valid).toBe(false); // Collides at [2, 3]

      const nonColliding = validateShipPlacement(10, 3, 1, 5, "vertical", existing);
      expect(nonColliding.valid).toBe(true);
    });

    it("accurately detects when entire fleet is sunk", () => {
      const fleet: PlacedShip[] = [
        { id: "s1", name: "Destroyer", size: 2, cells: [[0, 0], [0, 1]] },
        { id: "s2", name: "Cruiser", size: 3, cells: [[3, 3], [3, 4], [3, 5]] },
      ];

      const partialShots = new Map<string, ShotStatus>([
        ["0,0", "hit"],
        ["0,1", "hit"],
        ["3,3", "hit"],
        ["3,4", "miss"], // not hit
      ]);
      expect(checkBattleshipFleetSunk(fleet, partialShots)).toBe(false);

      const completeShots = new Map<string, ShotStatus>([
        ["0,0", "hit"],
        ["0,1", "hit"],
        ["3,3", "hit"],
        ["3,4", "hit"],
        ["3,5", "hit"],
        ["5,5", "miss"],
      ]);
      expect(checkBattleshipFleetSunk(fleet, completeShots)).toBe(true);
    });
  });

  describe("Cyber Pong Paddle Physics & Bounce Angles", () => {
    it("reverses horizontal velocity with acceleration upon direct center hit", () => {
      // paddleY = 100, paddleHeight = 80, center = 140
      // ballY = 135 (with BALL_SIZE 10, center is 140)
      const bounce = calculatePongPaddleBounce(135, 100, 80, -5.0);
      expect(bounce.vx).toBeGreaterThan(5.0); // reversed from negative to positive and accelerated
      expect(bounce.vx).toBeCloseTo(5.3, 1);
      expect(Math.abs(bounce.vy)).toBeLessThan(0.01);
    });

    it("angles ball upward when hitting top half of paddle", () => {
      // ball hit near top edge of paddle (e.g. ballY = 100, paddleY = 100)
      const bounce = calculatePongPaddleBounce(100, 100, 80, -5.0);
      expect(bounce.vx).toBeGreaterThan(0);
      expect(bounce.vy).toBeLessThan(0); // angles upward
    });

    it("angles ball downward when hitting bottom half of paddle", () => {
      // ball hit near bottom edge of paddle (e.g. ballY = 170, paddleY = 100)
      const bounce = calculatePongPaddleBounce(170, 100, 80, 5.0);
      expect(bounce.vx).toBeLessThan(0); // reversed from positive to negative
      expect(bounce.vy).toBeGreaterThan(0); // angles downward
    });

    it("caps max velocity at 13", () => {
      const bounce = calculatePongPaddleBounce(140, 100, 80, -20.0);
      expect(bounce.vx).toBe(13);
    });
  });

  describe("Memory Match Card Pair Evaluation", () => {
    it("identifies matching symbols correctly", () => {
      const cardA: MemoryCard = { id: 0, symbol: "crown", iconName: "Crown", isFlipped: true, isMatched: false };
      const cardB: MemoryCard = { id: 1, symbol: "crown", iconName: "Crown", isFlipped: true, isMatched: false };
      expect(checkMemoryCardsMatch(cardA, cardB)).toBe(true);
    });

    it("identifies mismatching symbols correctly", () => {
      const cardA: MemoryCard = { id: 0, symbol: "crown", iconName: "Crown", isFlipped: true, isMatched: false };
      const cardB: MemoryCard = { id: 2, symbol: "shield", iconName: "Shield", isFlipped: true, isMatched: false };
      expect(checkMemoryCardsMatch(cardA, cardB)).toBe(false);
    });

    it("fast-forwards mismatch flip-down and immediately flips clicked card without dropping clicks", () => {
      const cards: MemoryCard[] = [
        { id: 0, symbol: "crown", iconName: "Crown", isFlipped: true, isMatched: false },
        { id: 1, symbol: "shield", iconName: "Shield", isFlipped: true, isMatched: false },
        { id: 2, symbol: "gem", iconName: "Gem", isFlipped: false, isMatched: false },
        { id: 3, symbol: "gem", iconName: "Gem", isFlipped: false, isMatched: true },
      ];

      // User clicks card index 2 while pair [0, 1] is mismatched
      const result = applyFastForwardMismatch(cards, [0, 1], 2);
      expect(result.canFlipClicked).toBe(true);
      expect(result.nextCards[0]?.isFlipped).toBe(false); // First mismatched card flipped down
      expect(result.nextCards[1]?.isFlipped).toBe(false); // Second mismatched card flipped down
      expect(result.nextCards[2]?.isFlipped).toBe(true);  // Clicked card immediately flipped up!
      expect(result.nextFlipped).toEqual([2]);

      // If user clicks an already matched card, mismatch is still resolved but matched card remains matched
      const resultMatched = applyFastForwardMismatch(cards, [0, 1], 3);
      expect(resultMatched.canFlipClicked).toBe(false);
      expect(resultMatched.nextCards[0]?.isFlipped).toBe(false);
      expect(resultMatched.nextCards[1]?.isFlipped).toBe(false);
      expect(resultMatched.nextFlipped).toEqual([]);
    });
  });
});

