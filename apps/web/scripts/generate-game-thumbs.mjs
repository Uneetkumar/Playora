import fs from "node:fs";
import path from "node:path";

const targetDir = "/Users/uneetkumar/code-enviroment/MY DEV/game-platform/apps/web/public/games";

const thumbs = {
  "tic-tac-toe-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="50%" stop-color="#0f0e26" />
      <stop offset="100%" stop-color="#060511" />
    </radialGradient>
    <linearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <linearGradient id="neonX" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#fb7185" />
    </linearGradient>
    <linearGradient id="neonO" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glowX" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#f43f5e" flood-opacity="0.8" />
    </filter>
    <filter id="glowO" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#38bdf8" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg)" />
  <circle cx="400" cy="300" r="280" fill="#6366f1" opacity="0.08" filter="blur(40px)" />
  <!-- Grid Lines -->
  <g stroke="url(#gridGrad)" stroke-width="12" stroke-linecap="round" opacity="0.85">
    <line x1="300" y1="120" x2="300" y2="480" />
    <line x1="500" y1="120" x2="500" y2="480" />
    <line x1="140" y1="240" x2="660" y2="240" />
    <line x1="140" y1="360" x2="660" y2="360" />
  </g>
  <!-- Glowing X in top-left -->
  <g filter="url(#glowX)" stroke="url(#neonX)" stroke-width="18" stroke-linecap="round">
    <line x1="180" y1="140" x2="260" y2="220" />
    <line x1="260" y1="140" x2="180" y2="220" />
  </g>
  <!-- Glowing O in center -->
  <circle cx="400" cy="300" r="48" fill="none" stroke="url(#neonO)" stroke-width="18" filter="url(#glowO)" />
  <!-- Glowing X in bottom-right -->
  <g filter="url(#glowX)" stroke="url(#neonX)" stroke-width="18" stroke-linecap="round">
    <line x1="540" y1="380" x2="620" y2="460" />
    <line x1="620" y1="380" x2="540" y2="460" />
  </g>
  <!-- Floating small O in top-right -->
  <circle cx="580" cy="180" r="38" fill="none" stroke="url(#neonO)" stroke-width="14" filter="url(#glowO)" opacity="0.7" />
  <!-- Text Label -->
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">TIC TAC TOE</text>
</svg>`,

  "connect-four-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="cfBg" cx="50%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="60%" stop-color="#0a0a1f" />
      <stop offset="100%" stop-color="#03030d" />
    </radialGradient>
    <linearGradient id="boardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <radialGradient id="redDisc" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ff7b72" />
      <stop offset="60%" stop-color="#ef4444" />
      <stop offset="100%" stop-color="#991b1b" />
    </radialGradient>
    <radialGradient id="yellowDisc" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="60%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#854d0e" />
    </radialGradient>
    <filter id="shadow3d">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000" flood-opacity="0.7" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#cfBg)" />
  <circle cx="400" cy="280" r="300" fill="#3b82f6" opacity="0.12" filter="blur(60px)" />
  <!-- Main Grid Board -->
  <g filter="url(#shadow3d)">
    <rect x="140" y="100" width="520" height="380" rx="28" fill="url(#boardGrad)" stroke="#60a5fa" stroke-width="4" />
    <!-- Row slots -->
    <g fill="#0b1120">
      <!-- 7 columns, 5 rows -->
      <circle cx="200" cy="160" r="28" />
      <circle cx="265" cy="160" r="28" fill="url(#yellowDisc)" />
      <circle cx="330" cy="160" r="28" />
      <circle cx="400" cy="160" r="28" fill="url(#redDisc)" />
      <circle cx="470" cy="160" r="28" />
      <circle cx="535" cy="160" r="28" />
      <circle cx="600" cy="160" r="28" />

      <circle cx="200" cy="230" r="28" fill="url(#redDisc)" />
      <circle cx="265" cy="230" r="28" fill="url(#yellowDisc)" />
      <circle cx="330" cy="230" r="28" fill="url(#redDisc)" />
      <circle cx="400" cy="230" r="28" fill="url(#yellowDisc)" />
      <circle cx="470" cy="230" r="28" fill="url(#yellowDisc)" />
      <circle cx="535" cy="230" r="28" />
      <circle cx="600" cy="230" r="28" />

      <circle cx="200" cy="300" r="28" fill="url(#yellowDisc)" />
      <circle cx="265" cy="300" r="28" fill="url(#redDisc)" />
      <circle cx="330" cy="300" r="28" fill="url(#yellowDisc)" />
      <circle cx="400" cy="300" r="28" fill="url(#redDisc)" />
      <circle cx="470" cy="300" r="28" fill="url(#redDisc)" />
      <circle cx="535" cy="300" r="28" fill="url(#yellowDisc)" />
      <circle cx="600" cy="300" r="28" />

      <circle cx="200" cy="370" r="28" fill="url(#redDisc)" />
      <circle cx="265" cy="370" r="28" fill="url(#redDisc)" />
      <circle cx="330" cy="370" r="28" fill="url(#yellowDisc)" />
      <circle cx="400" cy="370" r="28" fill="url(#redDisc)" />
      <circle cx="470" cy="370" r="28" fill="url(#yellowDisc)" />
      <circle cx="535" cy="370" r="28" fill="url(#redDisc)" />
      <circle cx="600" cy="370" r="28" fill="url(#yellowDisc)" />

      <circle cx="200" cy="440" r="28" fill="url(#yellowDisc)" />
      <circle cx="265" cy="440" r="28" fill="url(#yellowDisc)" />
      <circle cx="330" cy="440" r="28" fill="url(#redDisc)" />
      <circle cx="400" cy="440" r="28" fill="url(#yellowDisc)" />
      <circle cx="470" cy="440" r="28" fill="url(#redDisc)" />
      <circle cx="535" cy="440" r="28" fill="url(#yellowDisc)" />
      <circle cx="600" cy="440" r="28" fill="url(#redDisc)" />
    </g>
  </g>
  <!-- Falling Disc with Motion Blur -->
  <g transform="translate(400, 50)" filter="url(#shadow3d)">
    <circle cx="0" cy="0" r="28" fill="url(#yellowDisc)" stroke="#fde047" stroke-width="2" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">CONNECT FOUR</text>
</svg>`,

  "ludo-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="ludoBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#2a1240" />
      <stop offset="50%" stop-color="#140722" />
      <stop offset="100%" stop-color="#07020d" />
    </radialGradient>
    <linearGradient id="diceGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <filter id="ludoGlow">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#a855f7" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#ludoBg)" />
  <!-- Center Glow -->
  <circle cx="400" cy="270" r="260" fill="#a855f7" opacity="0.15" filter="blur(50px)" />
  <!-- 3D Perspective Ludo Board -->
  <g transform="translate(400, 270) rotate(-6)" filter="url(#ludoGlow)">
    <!-- Board Base -->
    <rect x="-190" y="-190" width="380" height="380" rx="24" fill="#0f172a" stroke="#ffffff" stroke-opacity="0.15" stroke-width="4" />
    <!-- Quadrants -->
    <rect x="-170" y="-170" width="130" height="130" rx="16" fill="#ef4444" />
    <rect x="40" y="-170" width="130" height="130" rx="16" fill="#22c55e" />
    <rect x="-170" y="40" width="130" height="130" rx="16" fill="#3b82f6" />
    <rect x="40" y="40" width="130" height="130" rx="16" fill="#eab308" />

    <!-- Inner White Bases -->
    <rect x="-145" y="-145" width="80" height="80" rx="12" fill="#ffffff" />
    <circle cx="-125" cy="-125" r="10" fill="#ef4444" />
    <circle cx="-85" cy="-125" r="10" fill="#ef4444" />
    <circle cx="-125" cy="-85" r="10" fill="#ef4444" />
    <circle cx="-85" cy="-85" r="10" fill="#ef4444" />

    <rect x="65" y="-145" width="80" height="80" rx="12" fill="#ffffff" />
    <circle cx="85" cy="-125" r="10" fill="#22c55e" />
    <circle cx="125" cy="-125" r="10" fill="#22c55e" />
    <circle cx="85" cy="-85" r="10" fill="#22c55e" />
    <circle cx="125" cy="-85" r="10" fill="#22c55e" />

    <rect x="-145" y="65" width="80" height="80" rx="12" fill="#ffffff" />
    <circle cx="-125" cy="85" r="10" fill="#3b82f6" />
    <circle cx="-85" cy="85" r="10" fill="#3b82f6" />
    <circle cx="-125" cy="125" r="10" fill="#3b82f6" />
    <circle cx="-85" cy="125" r="10" fill="#3b82f6" />

    <rect x="65" y="65" width="80" height="80" rx="12" fill="#ffffff" />
    <circle cx="85" cy="85" r="10" fill="#eab308" />
    <circle cx="125" cy="85" r="10" fill="#eab308" />
    <circle cx="85" cy="125" r="10" fill="#eab308" />
    <circle cx="125" cy="125" r="10" fill="#eab308" />

    <!-- Center Home Triangles -->
    <polygon points="-40,-40 40,-40 0,0" fill="#22c55e" />
    <polygon points="40,-40 40,40 0,0" fill="#eab308" />
    <polygon points="40,40 -40,40 0,0" fill="#3b82f6" />
    <polygon points="-40,40 -40,-40 0,0" fill="#ef4444" />
  </g>
  <!-- Foreground Floating 3D Dice -->
  <g transform="translate(560, 360) rotate(14)" filter="url(#ludoGlow)">
    <rect x="-45" y="-45" width="90" height="90" rx="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" />
    <!-- 6 Pips in Red -->
    <circle cx="-22" cy="-22" r="7" fill="#dc2626" />
    <circle cx="22" cy="-22" r="7" fill="#dc2626" />
    <circle cx="-22" cy="0" r="7" fill="#dc2626" />
    <circle cx="22" cy="0" r="7" fill="#dc2626" />
    <circle cx="-22" cy="22" r="7" fill="#dc2626" />
    <circle cx="22" cy="22" r="7" fill="#dc2626" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">LUDO CLASSIC</text>
</svg>`,

  "snake-ladder-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="slBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="60%" stop-color="#022c22" />
      <stop offset="100%" stop-color="#01140f" />
    </radialGradient>
    <linearGradient id="goldLadder" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#ca8a04" />
      <stop offset="50%" stop-color="#facc15" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
    <linearGradient id="snakeSkin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="50%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#991b1b" />
    </linearGradient>
    <filter id="slGlow">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#10b981" flood-opacity="0.4" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#slBg)" />
  <circle cx="400" cy="280" r="280" fill="#10b981" opacity="0.12" filter="blur(50px)" />
  <!-- 10x10 Grid Board Representation -->
  <g transform="translate(180, 80)" filter="url(#slGlow)">
    <rect width="440" height="400" rx="20" fill="#0f172a" stroke="#10b981" stroke-width="3" />
    <!-- Alternating tiles grid -->
    ${Array.from({ length: 6 }).map((_, r) =>
      Array.from({ length: 7 }).map((_, c) => `
        <rect x="${c * 62 + 3}" y="${r * 66 + 2}" width="60" height="64" rx="8" fill="${(r + c) % 2 === 0 ? '#1e293b' : '#0f172a'}" opacity="0.75" />
      `).join("")
    ).join("")}
  </g>
  <!-- Golden Ascending Ladder -->
  <g stroke="url(#goldLadder)" stroke-linecap="round" opacity="0.95">
    <line x1="280" y1="440" x2="380" y2="120" stroke-width="8" />
    <line x1="330" y1="455" x2="430" y2="135" stroke-width="8" />
    <!-- Rungs -->
    <line x1="292" y1="400" x2="342" y2="415" stroke-width="6" />
    <line x1="312" y1="336" x2="362" y2="351" stroke-width="6" />
    <line x1="332" y1="272" x2="382" y2="287" stroke-width="6" />
    <line x1="352" y1="208" x2="402" y2="223" stroke-width="6" />
    <line x1="372" y1="144" x2="422" y2="159" stroke-width="6" />
  </g>
  <!-- Curving Serpentine Red Snake -->
  <path d="M540 130 Q440 200 520 280 T470 430" fill="none" stroke="url(#snakeSkin)" stroke-width="24" stroke-linecap="round" filter="url(#slGlow)" />
  <!-- Snake Head -->
  <circle cx="550" cy="125" r="18" fill="#ef4444" />
  <circle cx="554" cy="120" r="4" fill="#ffffff" />
  <circle cx="555" cy="120" r="2" fill="#000000" />
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">SNAKES &amp; LADDERS</text>
</svg>`,

  "checkers-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="chkBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#451a03" />
      <stop offset="60%" stop-color="#1c0d02" />
      <stop offset="100%" stop-color="#080300" />
    </radialGradient>
    <linearGradient id="woodLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fed7aa" />
      <stop offset="100%" stop-color="#fba866" />
    </linearGradient>
    <linearGradient id="woodDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#78350f" />
      <stop offset="100%" stop-color="#451a03" />
    </linearGradient>
    <radialGradient id="redPiece" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#f87171" />
      <stop offset="60%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#7f1d1d" />
    </radialGradient>
    <radialGradient id="blackPiece" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#52525b" />
      <stop offset="60%" stop-color="#27272a" />
      <stop offset="100%" stop-color="#09090b" />
    </radialGradient>
    <filter id="pieceShadow">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#chkBg)" />
  <!-- Isometric 3D Checkers Board -->
  <g transform="translate(180, 110) skewX(-16)" filter="url(#pieceShadow)">
    <rect width="460" height="340" rx="16" fill="#291404" stroke="#92400e" stroke-width="4" />
    ${Array.from({ length: 5 }).map((_, r) =>
      Array.from({ length: 7 }).map((_, c) => `
        <rect x="${c * 65 + 3}" y="${r * 67 + 3}" width="62" height="64" fill="${(r + c) % 2 === 0 ? 'url(#woodLight)' : 'url(#woodDark)'}" />
      `).join("")
    ).join("")}
  </g>
  <!-- Majestic Crowned Red King Piece in Foreground -->
  <g transform="translate(350, 270)" filter="url(#pieceShadow)">
    <ellipse cx="0" cy="18" rx="72" ry="38" fill="url(#redPiece)" />
    <ellipse cx="0" cy="0" rx="72" ry="38" fill="url(#redPiece)" stroke="#fca5a5" stroke-width="3" />
    <ellipse cx="0" cy="0" rx="54" ry="28" fill="#b91c1c" />
    <!-- Golden Crown on King -->
    <polygon points="-24,0 -30,-28 -12,-16 0,-34 12,-16 30,-28 24,0" fill="#facc15" stroke="#854d0e" stroke-width="2" />
  </g>
  <!-- Black Opponent Piece Jumping -->
  <g transform="translate(540, 190)" filter="url(#pieceShadow)">
    <ellipse cx="0" cy="14" rx="58" ry="30" fill="url(#blackPiece)" />
    <ellipse cx="0" cy="0" rx="58" ry="30" fill="url(#blackPiece)" stroke="#71717a" stroke-width="2" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">CHECKERS ROYALE</text>
</svg>`,

  "battleship-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="bsBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#083344" />
      <stop offset="60%" stop-color="#041f2a" />
      <stop offset="100%" stop-color="#010c12" />
    </radialGradient>
    <filter id="radarGlow">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#06b6d4" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bsBg)" />
  <!-- Glowing Radar Rings -->
  <g stroke="#06b6d4" fill="none" opacity="0.4" filter="url(#radarGlow)">
    <circle cx="400" cy="270" r="220" stroke-width="2" />
    <circle cx="400" cy="270" r="160" stroke-width="1.5" />
    <circle cx="400" cy="270" r="100" stroke-width="1.5" />
    <circle cx="400" cy="270" r="40" stroke-width="1.5" />
    <line x1="400" y1="50" x2="400" y2="490" stroke-width="1" />
    <line x1="180" y1="270" x2="620" y2="270" stroke-width="1" />
  </g>
  <!-- Rotating Radar Sweep Cone -->
  <path d="M400,270 L580,140 A220,220 0 0,0 400,50 Z" fill="#06b6d4" opacity="0.15" />
  <!-- Naval Warship Destroyer Silhouette -->
  <g transform="translate(400, 270)" filter="url(#radarGlow)">
    <path d="M-180,20 L-100,-25 L80,-25 L160,0 L200,20 L150,40 L-120,40 Z" fill="#1e293b" stroke="#38bdf8" stroke-width="3" />
    <!-- Turrets -->
    <rect x="-80" y="-45" width="40" height="20" rx="4" fill="#334155" stroke="#38bdf8" stroke-width="1.5" />
    <line x1="-80" y1="-35" x2="-120" y2="-45" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
    <rect x="20" y="-45" width="40" height="20" rx="4" fill="#334155" stroke="#38bdf8" stroke-width="1.5" />
    <line x1="60" y1="-35" x2="100" y2="-45" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
  </g>
  <!-- Fiery Torpedo Explosion -->
  <g transform="translate(490, 250)">
    <circle cx="0" cy="0" r="28" fill="#f97316" opacity="0.9" filter="blur(6px)" />
    <circle cx="0" cy="0" r="16" fill="#fde047" />
    <circle cx="0" cy="0" r="8" fill="#ffffff" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">BATTLESHIP</text>
</svg>`,

  "pong-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="pongBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <filter id="neonCyan">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#06b6d4" flood-opacity="0.9" />
    </filter>
    <filter id="neonPink">
      <feDropShadow dx="0" dy="0" stdDeviation="14" flood-color="#ec4899" flood-opacity="0.9" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#pongBg)" />
  <!-- Center Dashed Line -->
  <line x1="400" y1="80" x2="400" y2="460" stroke="#334155" stroke-width="6" stroke-dasharray="20,20" />
  <!-- Left Player Paddle (Cyan) -->
  <rect x="120" y="200" width="18" height="130" rx="9" fill="#06b6d4" filter="url(#neonCyan)" />
  <!-- Right Player Paddle (Pink) -->
  <rect x="660" y="160" width="18" height="130" rx="9" fill="#ec4899" filter="url(#neonPink)" />
  <!-- Ball Motion Trail -->
  <circle cx="310" cy="270" r="14" fill="#38bdf8" opacity="0.3" filter="blur(4px)" />
  <circle cx="360" cy="250" r="16" fill="#38bdf8" opacity="0.6" filter="blur(2px)" />
  <!-- Laser Ball with Glow -->
  <circle cx="420" cy="230" r="18" fill="#ffffff" stroke="#06b6d4" stroke-width="4" filter="url(#neonCyan)" />
  <!-- Digital Scores in Background -->
  <text x="320" y="170" font-family="monospace" font-weight="900" font-size="72" fill="#38bdf8" opacity="0.25">3</text>
  <text x="440" y="170" font-family="monospace" font-weight="900" font-size="72" fill="#ec4899" opacity="0.25">1</text>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">CYBER PONG</text>
</svg>`,

  "memory-match-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="mmBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#4a044e" />
      <stop offset="60%" stop-color="#1f0221" />
      <stop offset="100%" stop-color="#0a000b" />
    </radialGradient>
    <linearGradient id="cardFace" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#be123c" />
    </linearGradient>
    <filter id="cardGlow">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#ec4899" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#mmBg)" />
  <circle cx="400" cy="270" r="260" fill="#ec4899" opacity="0.12" filter="blur(60px)" />
  <!-- Matching Pair Flipped Cards in Center -->
  <g transform="translate(230, 150) rotate(-8)" filter="url(#cardGlow)">
    <rect width="160" height="220" rx="20" fill="#ffffff" stroke="#ec4899" stroke-width="4" />
    <!-- Diamond Gem Icon -->
    <polygon points="80,50 130,110 80,170 30,110" fill="url(#cardFace)" />
    <circle cx="80" cy="110" r="14" fill="#ffffff" opacity="0.8" />
  </g>
  <g transform="translate(420, 140) rotate(8)" filter="url(#cardGlow)">
    <rect width="160" height="220" rx="20" fill="#ffffff" stroke="#ec4899" stroke-width="4" />
    <!-- Matching Diamond Gem Icon -->
    <polygon points="80,50 130,110 80,170 30,110" fill="url(#cardFace)" />
    <circle cx="80" cy="110" r="14" fill="#ffffff" opacity="0.8" />
  </g>
  <!-- Sparkles -->
  <circle cx="400" cy="140" r="8" fill="#facc15" filter="blur(1px)" />
  <circle cx="390" cy="380" r="6" fill="#facc15" filter="blur(1px)" />
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">MEMORY MATCH</text>
</svg>`,

  "game-2048-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="g2048Bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#451a03" />
      <stop offset="60%" stop-color="#1f0b02" />
      <stop offset="100%" stop-color="#0a0300" />
    </radialGradient>
    <linearGradient id="gold2048" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#facc15" />
      <stop offset="100%" stop-color="#eab308" />
    </linearGradient>
    <filter id="tileGlow">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#eab308" flood-opacity="0.6" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#g2048Bg)" />
  <!-- Center Glow -->
  <circle cx="400" cy="270" r="260" fill="#eab308" opacity="0.15" filter="blur(60px)" />
  <!-- 2048 Game Board Grid -->
  <rect x="220" y="90" width="360" height="360" rx="24" fill="#291404" stroke="#78350f" stroke-width="4" />
  <!-- Small Tiles -->
  <rect x="240" y="110" width="70" height="70" rx="12" fill="#eee4da" />
  <text x="275" y="154" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#776e65">2</text>
  <rect x="325" y="110" width="70" height="70" rx="12" fill="#ede0c8" />
  <text x="360" y="154" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#776e65">4</text>
  <rect x="410" y="110" width="70" height="70" rx="12" fill="#f2b179" />
  <text x="445" y="154" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#f9f6f2">8</text>
  <rect x="495" y="110" width="70" height="70" rx="12" fill="#f59563" />
  <text x="530" y="154" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#f9f6f2">16</text>
  <!-- Giant Glowing 2048 Tile in Center-Right -->
  <g transform="translate(325, 200)" filter="url(#tileGlow)">
    <rect width="240" height="230" rx="20" fill="url(#gold2048)" stroke="#fef08a" stroke-width="3" />
    <text x="120" y="145" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="76" fill="#ffffff" letter-spacing="-2">2048</text>
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">2048 PUZZLE</text>
</svg>`,

  "minesweeper-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="msBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="60%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <linearGradient id="mineMetal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <filter id="mineShadow">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#msBg)" />
  <!-- Grid Pattern -->
  <g stroke="#334155" stroke-width="2" opacity="0.4">
    ${Array.from({ length: 8 }).map((_, i) => `
      <line x1="100" y1="${i * 60 + 60}" x2="700" y2="${i * 60 + 60}" />
      <line x1="${i * 85 + 100}" y1="60" x2="${i * 85 + 100}" y2="480" />
    `).join("")}
  </g>
  <!-- Cyber Mine Spikes -->
  <g transform="translate(400, 270)" filter="url(#mineShadow)">
    <circle cx="0" cy="0" r="100" fill="url(#mineMetal)" stroke="#64748b" stroke-width="4" />
    <!-- Spikes -->
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => `
      <g transform="rotate(${angle})">
        <rect x="-10" y="-140" width="20" height="50" rx="6" fill="#475569" stroke="#64748b" stroke-width="2" />
        <circle cx="0" cy="-145" r="8" fill="#ef4444" />
      </g>
    `).join("")}
    <!-- Center Danger Red Light -->
    <circle cx="0" cy="0" r="32" fill="#ef4444" filter="blur(2px)" />
    <circle cx="0" cy="0" r="16" fill="#ffffff" />
  </g>
  <!-- Red Warning Flag beside it -->
  <g transform="translate(560, 160)" filter="url(#mineShadow)">
    <line x1="0" y1="0" x2="0" y2="120" stroke="#94a3b8" stroke-width="6" stroke-linecap="round" />
    <polygon points="0,10 60,35 0,60" fill="#ef4444" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">MINESWEEPER</text>
</svg>`,

  "word-guess-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="wgBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="60%" stop-color="#022c22" />
      <stop offset="100%" stop-color="#01140f" />
    </radialGradient>
    <filter id="tileGlow2">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#10b981" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#wgBg)" />
  <circle cx="400" cy="270" r="260" fill="#10b981" opacity="0.12" filter="blur(60px)" />
  <!-- 5 Green Tiles forming WORD -->
  <g transform="translate(140, 210)" filter="url(#tileGlow2)">
    <!-- W -->
    <rect x="0" y="0" width="90" height="96" rx="16" fill="#10b981" stroke="#34d399" stroke-width="3" />
    <text x="45" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="54" fill="#ffffff">W</text>
    <!-- O -->
    <rect x="105" y="0" width="90" height="96" rx="16" fill="#10b981" stroke="#34d399" stroke-width="3" />
    <text x="150" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="54" fill="#ffffff">O</text>
    <!-- R -->
    <rect x="210" y="0" width="90" height="96" rx="16" fill="#eab308" stroke="#fde047" stroke-width="3" />
    <text x="255" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="54" fill="#ffffff">R</text>
    <!-- D -->
    <rect x="315" y="0" width="90" height="96" rx="16" fill="#10b981" stroke="#34d399" stroke-width="3" />
    <text x="360" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="54" fill="#ffffff">D</text>
    <!-- S -->
    <rect x="420" y="0" width="90" height="96" rx="16" fill="#10b981" stroke="#34d399" stroke-width="3" />
    <text x="465" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="54" fill="#ffffff">S</text>
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">WORD GUESS</text>
</svg>`,

  "flappy-bird-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <linearGradient id="fbSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="70%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#7dd3fc" />
    </linearGradient>
    <linearGradient id="pipeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e" />
      <stop offset="50%" stop-color="#4ade80" />
      <stop offset="100%" stop-color="#15803d" />
    </linearGradient>
    <filter id="birdShadow">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#fbSky)" />
  <!-- Green Pipes -->
  <g filter="url(#birdShadow)">
    <!-- Top Pipe -->
    <rect x="520" y="0" width="90" height="190" fill="url(#pipeGrad)" stroke="#166534" stroke-width="3" />
    <rect x="510" y="160" width="110" height="30" rx="4" fill="url(#pipeGrad)" stroke="#166534" stroke-width="3" />
    <!-- Bottom Pipe -->
    <rect x="520" y="320" width="90" height="280" fill="url(#pipeGrad)" stroke="#166534" stroke-width="3" />
    <rect x="510" y="320" width="110" height="30" rx="4" fill="url(#pipeGrad)" stroke="#166534" stroke-width="3" />
  </g>
  <!-- Flappy Yellow Bird Flying -->
  <g transform="translate(320, 240) rotate(-10)" filter="url(#birdShadow)">
    <circle cx="0" cy="0" r="45" fill="#facc15" stroke="#ca8a04" stroke-width="3" />
    <!-- White Wing -->
    <ellipse cx="-16" cy="6" rx="22" ry="14" fill="#ffffff" stroke="#ca8a04" stroke-width="2" />
    <!-- Big Eye -->
    <circle cx="18" cy="-12" r="14" fill="#ffffff" stroke="#ca8a04" stroke-width="2" />
    <circle cx="22" cy="-12" r="6" fill="#000000" />
    <!-- Orange Beak -->
    <polygon points="32,-2 60,6 30,16" fill="#f97316" stroke="#c2410c" stroke-width="2" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">FLAPPY BIRD</text>
</svg>`,

  "retro-snake-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="rsBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#022c22" />
      <stop offset="70%" stop-color="#01140f" />
      <stop offset="100%" stop-color="#000503" />
    </radialGradient>
    <filter id="neonSnake">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#22c55e" flood-opacity="0.9" />
    </filter>
    <filter id="neonFood">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#ef4444" flood-opacity="0.9" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#rsBg)" />
  <!-- Neon Grid Background -->
  <g stroke="#064e3b" stroke-width="1" opacity="0.5">
    ${Array.from({ length: 14 }).map((_, i) => `
      <line x1="80" y1="${i * 35 + 60}" x2="720" y2="${i * 35 + 60}" />
      <line x1="${i * 45 + 80}" y1="60" x2="${i * 45 + 80}" y2="515" />
    `).join("")}
  </g>
  <!-- Curving Glowing Cyber Snake Segments -->
  <g fill="#22c55e" filter="url(#neonSnake)">
    <rect x="200" y="340" width="36" height="36" rx="8" />
    <rect x="240" y="340" width="36" height="36" rx="8" />
    <rect x="280" y="340" width="36" height="36" rx="8" />
    <rect x="320" y="340" width="36" height="36" rx="8" />
    <rect x="320" y="300" width="36" height="36" rx="8" />
    <rect x="320" y="260" width="36" height="36" rx="8" />
    <rect x="360" y="260" width="36" height="36" rx="8" />
    <rect x="400" y="260" width="36" height="36" rx="8" />
    <rect x="440" y="260" width="36" height="36" rx="8" />
    <rect x="480" y="260" width="36" height="36" rx="8" />
    <!-- Head with Eyes -->
    <rect x="520" y="260" width="40" height="36" rx="10" fill="#4ade80" />
    <circle cx="548" cy="270" r="4" fill="#000000" />
    <circle cx="548" cy="286" r="4" fill="#000000" />
  </g>
  <!-- Glowing Apple Target -->
  <circle cx="640" cy="278" r="18" fill="#ef4444" filter="url(#neonFood)" />
  <circle cx="636" cy="272" r="5" fill="#ffffff" />
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">RETRO SNAKE</text>
</svg>`,

  "brick-breaker-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="bbBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#31102b" />
      <stop offset="60%" stop-color="#140612" />
      <stop offset="100%" stop-color="#070206" />
    </radialGradient>
    <filter id="bbGlow">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#f43f5e" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bbBg)" />
  <!-- Multicolored Glowing Bricks -->
  <g filter="url(#bbGlow)">
    <!-- Row 1: Ruby Red -->
    <rect x="150" y="100" width="110" height="32" rx="6" fill="#f43f5e" />
    <rect x="270" y="100" width="110" height="32" rx="6" fill="#f43f5e" />
    <rect x="390" y="100" width="110" height="32" rx="6" fill="#f43f5e" />
    <rect x="510" y="100" width="110" height="32" rx="6" fill="#f43f5e" />
    <!-- Row 2: Amber Gold -->
    <rect x="150" y="140" width="110" height="32" rx="6" fill="#f59e0b" />
    <rect x="270" y="140" width="110" height="32" rx="6" fill="#f59e0b" />
    <rect x="390" y="140" width="110" height="32" rx="6" fill="#f59e0b" />
    <rect x="510" y="140" width="110" height="32" rx="6" fill="#f59e0b" />
    <!-- Row 3: Emerald Cyan -->
    <rect x="150" y="180" width="110" height="32" rx="6" fill="#06b6d4" />
    <rect x="390" y="180" width="110" height="32" rx="6" fill="#06b6d4" />
    <rect x="510" y="180" width="110" height="32" rx="6" fill="#06b6d4" />
  </g>
  <!-- Energetic Ball bouncing -->
  <circle cx="330" cy="240" r="16" fill="#ffffff" filter="url(#bbGlow)" />
  <!-- Bottom Paddle -->
  <rect x="320" y="440" width="160" height="22" rx="11" fill="#38bdf8" filter="url(#bbGlow)" />
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">BRICK BREAKER</text>
</svg>`,

  "whack-a-mole-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="wamBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#2e1065" />
      <stop offset="60%" stop-color="#14062e" />
      <stop offset="100%" stop-color="#080214" />
    </radialGradient>
    <filter id="wamShadow">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#a855f7" flood-opacity="0.5" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#wamBg)" />
  <circle cx="400" cy="270" r="260" fill="#a855f7" opacity="0.15" filter="blur(60px)" />
  <!-- Holes in Turf -->
  <ellipse cx="240" cy="240" rx="65" ry="32" fill="#090514" stroke="#a855f7" stroke-width="2" />
  <ellipse cx="560" cy="240" rx="65" ry="32" fill="#090514" stroke="#a855f7" stroke-width="2" />
  <ellipse cx="400" cy="380" rx="90" ry="42" fill="#090514" stroke="#a855f7" stroke-width="3" />
  <!-- Mischievous Mole popping up in Center Hole -->
  <g transform="translate(400, 310)" filter="url(#wamShadow)">
    <path d="M-55,50 C-55,-60 55,-60 55,50 Z" fill="#92400e" stroke="#b45309" stroke-width="3" />
    <!-- Cheeks & Snout -->
    <ellipse cx="0" cy="-6" rx="30" ry="20" fill="#fde68a" />
    <circle cx="0" cy="-14" r="10" fill="#dc2626" />
    <!-- Eyes -->
    <circle cx="-22" cy="-28" r="8" fill="#ffffff" />
    <circle cx="-20" cy="-28" r="4" fill="#000000" />
    <circle cx="22" cy="-28" r="8" fill="#ffffff" />
    <circle cx="20" cy="-28" r="4" fill="#000000" />
    <!-- Front Paws -->
    <circle cx="-42" cy="40" r="14" fill="#fde68a" />
    <circle cx="42" cy="40" r="14" fill="#fde68a" />
  </g>
  <!-- Wooden Whack Mallet -->
  <g transform="translate(540, 180) rotate(-32)" filter="url(#wamShadow)">
    <rect x="-14" y="0" width="28" height="180" rx="8" fill="#ca8a04" stroke="#854d0e" stroke-width="2" />
    <rect x="-45" y="-55" width="90" height="70" rx="14" fill="#ef4444" stroke="#b91c1c" stroke-width="3" />
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">WHACK-A-MOLE</text>
</svg>`,

  "simon-says-thumb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <radialGradient id="simonBg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="60%" stop-color="#0d0c24" />
      <stop offset="100%" stop-color="#04030d" />
    </radialGradient>
    <filter id="simonGlow">
      <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#3b82f6" flood-opacity="0.8" />
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#simonBg)" />
  <!-- Center Simon Console Wheel -->
  <g transform="translate(400, 270)" filter="url(#simonGlow)">
    <!-- Base Outer Shell -->
    <circle cx="0" cy="0" r="180" fill="#0f172a" stroke="#ffffff" stroke-opacity="0.2" stroke-width="6" />
    <!-- 4 Quadrants -->
    <!-- Green (Top-Left) -->
    <path d="M-10,-10 L-10,-160 A150,150 0 0,0 -160,-10 Z" fill="#22c55e" stroke="#15803d" stroke-width="4" opacity="0.85" />
    <!-- Red (Top-Right) -->
    <path d="M10,-10 L160,-10 A150,150 0 0,0 10,-160 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="4" opacity="0.95" filter="drop-shadow(0 0 16px #ef4444)" />
    <!-- Yellow (Bottom-Left) -->
    <path d="M-10,10 L-160,10 A150,150 0 0,0 -10,160 Z" fill="#eab308" stroke="#a16207" stroke-width="4" opacity="0.85" />
    <!-- Blue (Bottom-Right) -->
    <path d="M10,10 L10,160 A150,150 0 0,0 160,10 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="4" opacity="0.85" />
    <!-- Center Hub -->
    <circle cx="0" cy="0" r="60" fill="#020617" stroke="#334155" stroke-width="4" />
    <circle cx="0" cy="0" r="42" fill="#0f172a" />
    <text x="0" y="8" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="20" fill="#ffffff" letter-spacing="2">SIMON</text>
  </g>
  <text x="400" y="550" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="32" fill="#ffffff" letter-spacing="4" opacity="0.95">SIMON SAYS</text>
</svg>`,
};

for (const [filename, content] of Object.entries(thumbs)) {
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, content.trim(), "utf-8");
  console.log("Wrote", filePath);
}
console.log("All 16 game thumbnails generated successfully!");
