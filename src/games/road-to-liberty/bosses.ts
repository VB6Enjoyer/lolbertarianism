// The bosses' artwork: detailed SVGs drawn onto the road canvas. The moving
// parts (treads, brake lights, rotors, beacon, searchlight) are drawn on top
// by render.ts so they can animate.

const svgImage = (svg: string) => {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
};

const lines = (x1: number, x2: number, from: number, to: number, step: number) => {
  let d = '';
  for (let y = from; y <= to; y += step) d += `M${x1} ${y}H${x2}`;
  return d;
};

/** The tank from behind, 300×180 (the sprite's 5:3). Tracks are left plain for the moving treads. */
export const TANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180">
<defs>
  <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8c48"/><stop offset="1" stop-color="#465223"/></linearGradient>
  <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93a35a"/><stop offset="1" stop-color="#6c7b38"/></linearGradient>
  <linearGradient id="turret" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aab5e"/><stop offset="1" stop-color="#56642c"/></linearGradient>
  <linearGradient id="track" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#161616"/><stop offset=".5" stop-color="#383838"/><stop offset="1" stop-color="#161616"/></linearGradient>
  <radialGradient id="bore"><stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#0d0d0d"/><stop offset="1" stop-color="#3a3a3a"/></radialGradient>
</defs>
<ellipse cx="150" cy="172" rx="150" ry="9" fill="rgba(0,0,0,0.35)"/>
<rect x="12" y="92" width="62" height="80" rx="10" fill="url(#track)"/>
<rect x="226" y="92" width="62" height="80" rx="10" fill="url(#track)"/>
<g fill="#2b2b2b" stroke="#5a5a5a" stroke-width="3">
  <circle cx="43" cy="104" r="15"/><circle cx="257" cy="104" r="15"/>
</g>
<g fill="#777"><circle cx="43" cy="104" r="4"/><circle cx="257" cy="104" r="4"/></g>
<path d="M44 74 L256 74 L266 92 L256 152 L44 152 L34 92 Z" fill="url(#hull)" stroke="#333d17" stroke-width="2"/>
<path d="M48 60 L252 60 L258 74 L42 74 Z" fill="url(#deck)" stroke="#333d17" stroke-width="2"/>
<rect x="4" y="80" width="80" height="14" rx="3" fill="url(#deck)" stroke="#333d17" stroke-width="2"/>
<rect x="216" y="80" width="80" height="14" rx="3" fill="url(#deck)" stroke="#333d17" stroke-width="2"/>
<rect x="10" y="66" width="40" height="15" rx="2" fill="#5d6b30" stroke="#333d17" stroke-width="2"/>
<rect x="250" y="66" width="40" height="15" rx="2" fill="#5d6b30" stroke="#333d17" stroke-width="2"/>
<path d="M20 73.5H40M260 73.5H280" stroke="#333d17" stroke-width="2"/>
<rect x="100" y="98" width="100" height="36" rx="4" fill="#262c12" stroke="#333d17" stroke-width="2"/>
<path d="${lines(104, 196, 104, 128, 6)}" stroke="#56622c" stroke-width="3"/>
<g fill="#1c1c1c" stroke="#5f5f5f" stroke-width="3"><circle cx="76" cy="122" r="9"/><circle cx="224" cy="122" r="9"/></g>
<g fill="#000"><circle cx="76" cy="122" r="4"/><circle cx="224" cy="122" r="4"/></g>
<rect x="48" y="98" width="20" height="11" rx="2" fill="#4a0000" stroke="#222" stroke-width="1.5"/>
<rect x="232" y="98" width="20" height="11" rx="2" fill="#4a0000" stroke="#222" stroke-width="1.5"/>
<rect x="48" y="111" width="20" height="6" rx="1" fill="#6b5200" stroke="#222" stroke-width="1"/>
<rect x="232" y="111" width="20" height="6" rx="1" fill="#6b5200" stroke="#222" stroke-width="1"/>
<rect x="120" y="138" width="60" height="13" rx="1.5" fill="#efe7c4" stroke="#222" stroke-width="1.5"/>
<text x="150" y="148" font-family="Courier New, monospace" font-weight="bold" font-size="10" text-anchor="middle" fill="#1a237e">IRS·1040</text>
<path d="M84 152 q0 9 9 9 M216 152 q0 9 -9 9" fill="none" stroke="#222" stroke-width="4" stroke-linecap="round"/>
<path d="M96 32 L92 2" stroke="#1a1a1a" stroke-width="1.6"/>
<path d="M208 30 L216 0" stroke="#1a1a1a" stroke-width="1.6"/>
<path d="M92 2 L104 6 L93 10 Z" fill="#c62828"/>
<path d="M82 66 Q80 34 114 26 L186 26 Q220 34 218 66 Z" fill="url(#turret)" stroke="#333d17" stroke-width="2"/>
<path d="M90 60 H210" stroke="#3f4a1d" stroke-width="2"/>
<rect x="88" y="54" width="124" height="12" rx="2" fill="none" stroke="#3f4a1d" stroke-width="2" stroke-dasharray="5 3"/>
<ellipse cx="188" cy="29" rx="15" ry="5.5" fill="#4b5826" stroke="#2c3412" stroke-width="1.5"/>
<path d="M186 26 L212 14" stroke="#1a1a1a" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="150" cy="47" r="17" fill="#46521f" stroke="#2c3412" stroke-width="2"/>
<circle cx="150" cy="47" r="12" fill="#2f2f2f" stroke="#555" stroke-width="2"/>
<circle cx="150" cy="47" r="8" fill="url(#bore)"/>
<text x="113" y="50" font-family="Courier New, monospace" font-weight="bold" font-size="13" text-anchor="middle" fill="#efe9c8">IRS</text>
<text x="188" y="50" font-family="Courier New, monospace" font-weight="bold" font-size="11" text-anchor="middle" fill="#efe9c8">1040</text>
<text x="150" y="90" font-family="Courier New, monospace" font-weight="bold" font-size="8" text-anchor="middle" fill="#e6dfb8" opacity="0.85">TAX ENFORCEMENT DIVISION</text>
</svg>`;

/** Where the moving parts go on the tank, in its 300×180 box. */
export const TANK_PARTS = {
  tracks: [{ x: 12, w: 62 }, { x: 226, w: 62 }],
  trackTop: 120,
  trackBottom: 170,
  brakeLights: [{ x: 48, y: 98, w: 20, h: 11 }, { x: 232, y: 98, w: 20, h: 11 }],
} as const;

/** IRS Air Support from the side, nose to the left, 240×120. The rotors are drawn separately. */
export const HELI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120">
<defs>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5a63"/><stop offset=".55" stop-color="#2c383e"/><stop offset="1" stop-color="#161e22"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4ecff"/><stop offset=".5" stop-color="#7fb3d9"/><stop offset="1" stop-color="#2f5d80"/></linearGradient>
</defs>
<path d="M122 50 L218 44 L220 53 L122 68 Z" fill="url(#body)" stroke="#11181b" stroke-width="1.5"/>
<path d="M204 46 L216 14 L228 14 L224 50 Z" fill="url(#body)" stroke="#11181b" stroke-width="1.5"/>
<rect x="190" y="52" width="26" height="5" rx="2" fill="#263238"/>
<path d="M64 84 L58 101 M128 80 L134 101" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/>
<path d="M36 102 L156 102 Q164 102 166 96" fill="none" stroke="#1b1b1b" stroke-width="4.5" stroke-linecap="round"/>
<path d="M80 34 Q86 18 114 17 L134 19 Q144 23 142 34 Z" fill="#26323a" stroke="#11181b" stroke-width="1.5"/>
<path d="M120 22 h14 M118 27 h18" stroke="#11181b" stroke-width="1.5"/>
<rect x="104" y="7" width="7" height="12" fill="#1b1b1b"/>
<path d="M28 70 Q22 44 56 34 L122 30 Q154 32 158 52 L152 78 Q112 90 52 88 Q30 84 28 70 Z" fill="url(#body)" stroke="#11181b" stroke-width="2"/>
<path d="M30 66 Q28 47 56 38 L76 37 L76 67 Z" fill="url(#glass)" stroke="#11181b" stroke-width="2"/>
<path d="M54 39 L56 67" stroke="#11181b" stroke-width="2"/>
<rect x="84" y="41" width="28" height="19" rx="3" fill="url(#glass)" stroke="#11181b" stroke-width="2"/>
<path d="M36 76 L154 66 L153 72 L42 82 Z" fill="#ffd54f"/>
<text x="126" y="60" font-family="Courier New, monospace" font-weight="bold" font-size="15" text-anchor="middle" fill="#fff">IRS</text>
<text x="176" y="61" font-family="Courier New, monospace" font-weight="bold" font-size="7" text-anchor="middle" fill="#cfd8dc" transform="rotate(-4 176 61)">AIR SUPPORT</text>
<circle cx="44" cy="88" r="5" fill="#fffde7" stroke="#333" stroke-width="1.5"/>
<path d="M150 50 L160 50" stroke="#11181b" stroke-width="3"/>
</svg>`;

/** Where the moving parts go on the helicopter, in its 240×120 box. */
export const HELI_PARTS = {
  rotorHub: { x: 107.5, y: 7 },
  tailRotor: { x: 222, y: 42 },
  searchlight: { x: 44, y: 88 },
  beacon: { x: 100, y: 88 },
  /** The point placed at the boss's position (the middle of the cabin). */
  anchor: { x: 92, y: 60 },
} as const;

let tank: HTMLImageElement | null = null;
let heli: HTMLImageElement | null = null;

/** The images, made on first use (and null until they've loaded). */
export function tankImage(): HTMLImageElement | null {
  tank ??= svgImage(TANK_SVG);
  return tank.complete && tank.naturalWidth ? tank : null;
}

export function heliImage(): HTMLImageElement | null {
  heli ??= svgImage(HELI_SVG);
  return heli.complete && heli.naturalWidth ? heli : null;
}
