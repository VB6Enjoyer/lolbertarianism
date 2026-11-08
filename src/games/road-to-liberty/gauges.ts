// The instrument cluster: an analog speedometer (0-260 km/h) with a digital
// readout, and a fuel gauge (E to F) with a low-fuel light. Built as SVG.

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}

/** Point on a circle; angle in degrees, 0 = straight up, clockwise. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export const SPEEDO_MAX = 260;
/** The speedometer sweeps from -135° (0 km/h) to +135° (260 km/h). */
const SPEEDO_SWEEP = 270;

export interface Gauges {
  setSpeed(kmh: number): void;
  setFuel(share: number, low: boolean): void;
}

export function buildGauges(speedo: SVGSVGElement, fuel: SVGSVGElement): Gauges {
  // Speedometer
  svgEl('circle', { cx: 100, cy: 100, r: 94, class: 'gauge-face' }, speedo);
  for (let kmh = 0; kmh <= SPEEDO_MAX; kmh += 10) {
    const deg = -SPEEDO_SWEEP / 2 + (kmh / SPEEDO_MAX) * SPEEDO_SWEEP;
    const major = kmh % 40 === 0;
    const [x1, y1] = polar(100, 100, major ? 74 : 80, deg);
    const [x2, y2] = polar(100, 100, 88, deg);
    svgEl('line', { x1, y1, x2, y2, class: `gauge-tick${major ? ' major' : ''}${kmh >= 220 ? ' red' : ''}` }, speedo);
    if (major) {
      const [lx, ly] = polar(100, 100, 60, deg);
      svgEl('text', { x: lx, y: ly, class: 'gauge-label' }, speedo).textContent = String(kmh);
    }
  }
  const digital = svgEl('text', { x: 100, y: 146, class: 'gauge-digital' }, speedo);
  svgEl('text', { x: 100, y: 160, class: 'gauge-unit' }, speedo).textContent = 'km/h';
  const needle = svgEl('line', { x1: 100, y1: 112, x2: 100, y2: 26, class: 'gauge-needle' }, speedo);
  svgEl('circle', { cx: 100, cy: 100, r: 8, class: 'gauge-cap' }, speedo);

  // Fuel gauge: a 120° arc from E (left) to F (right)
  svgEl('circle', { cx: 60, cy: 60, r: 56, class: 'gauge-face' }, fuel);
  for (let i = 0; i <= 4; i++) {
    const deg = -60 + i * 30;
    const [x1, y1] = polar(60, 66, i % 2 ? 40 : 36, deg);
    const [x2, y2] = polar(60, 66, 46, deg);
    svgEl('line', { x1, y1, x2, y2, class: `gauge-tick${i % 2 ? '' : ' major'}${i === 0 ? ' red' : ''}` }, fuel);
  }
  const [ex, ey] = polar(60, 66, 28, -60);
  const [fx, fy] = polar(60, 66, 28, 60);
  svgEl('text', { x: ex, y: ey, class: 'gauge-label' }, fuel).textContent = 'E';
  svgEl('text', { x: fx, y: fy, class: 'gauge-label' }, fuel).textContent = 'F';
  const light = svgEl('circle', { cx: 60, cy: 92, r: 9, class: 'fuel-light' }, fuel);
  svgEl('text', { x: 60, y: 93, class: 'gauge-label', 'font-size': 10 }, fuel).textContent = '⛽';
  const fuelNeedle = svgEl('line', { x1: 60, y1: 70, x2: 60, y2: 24, class: 'gauge-needle' }, fuel);
  svgEl('circle', { cx: 60, cy: 66, r: 5, class: 'gauge-cap' }, fuel);

  return {
    setSpeed(kmh) {
      const clamped = Math.max(0, Math.min(SPEEDO_MAX, kmh));
      const deg = -SPEEDO_SWEEP / 2 + (clamped / SPEEDO_MAX) * SPEEDO_SWEEP;
      needle.setAttribute('transform', `rotate(${deg} 100 100)`);
      digital.textContent = String(Math.round(kmh));
    },
    setFuel(share, low) {
      const deg = -60 + Math.max(0, Math.min(1, share)) * 120;
      fuelNeedle.setAttribute('transform', `rotate(${deg} 60 66)`);
      light.classList.toggle('on', low);
    },
  };
}
