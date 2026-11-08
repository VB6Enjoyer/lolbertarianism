import { describe, expect, it } from 'vitest';
import { ADS, broadcastLabel, broadcastSeconds, buildProgram, PLAYLIST, SEGMENT_SECONDS, SONG_SECONDS, TALK } from './radio.ts';
import { BUTTON, PadReader, stickAxis, type PadLike } from './gamepad.ts';
import { bestMoment, momentFor } from './photo.ts';
import { shareText, type RunSummary } from './share.ts';
import { blink, defaultOptions, display, normalizeOptions } from './settings.ts';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('road to liberty: radio talk and ads', () => {
  it('plays every song once, with a break after every two, alternating talk and ads', () => {
    const program = buildProgram(rng(3));
    const songs = program.filter((b) => b.kind === 'song');
    expect(songs).toHaveLength(PLAYLIST.length);
    expect(new Set(songs.map((b) => b.kind === 'song' && b.song.title)).size).toBe(PLAYLIST.length);
    const breaks = program.filter((b) => b.kind !== 'song');
    expect(breaks).toHaveLength(Math.floor(PLAYLIST.length / 2));
    expect(breaks.map((b) => b.kind).slice(0, 4)).toEqual(['talk', 'ad', 'talk', 'ad']);
    expect(program[0].kind).toBe('song');
    expect(program[2].kind).toBe('talk');
    // No segment repeats in one pass
    const texts = breaks.map((b) => ('text' in b ? b.text : ''));
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect([...TALK, ...ADS]).toContain(t);
  });

  it('labels and timing', () => {
    expect(broadcastLabel({ kind: 'ad', text: 'Gold. Because the Fed said so.' })).toBe('📢 AD · Gold. Because the Fed said so.');
    expect(broadcastLabel({ kind: 'talk', text: 'Hi' })).toBe('🎙️ ON AIR · Hi');
    expect(broadcastLabel({ kind: 'song', song: PLAYLIST[0] })).toBe(`♪ ${PLAYLIST[0].artist} - ${PLAYLIST[0].title}`);
    expect(broadcastSeconds({ kind: 'talk', text: '' })).toBe(SEGMENT_SECONDS);
    expect(broadcastSeconds({ kind: 'song', song: PLAYLIST[0] })).toBe(SONG_SECONDS);
  });
});

function fakePad(pressed: number[] = [], axes: number[] = [0, 0], values: Record<number, number> = {}): PadLike {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: values[i] ?? (pressed.includes(i) ? 1 : 0) })),
  };
}

describe('road to liberty: gamepad', () => {
  it('a dead zone in the middle of the stick, still reaching full lock', () => {
    expect(stickAxis(0.1)).toBe(0);
    expect(stickAxis(-1)).toBe(-1);
    expect(stickAxis(0.6)).toBeCloseTo(0.5);
  });

  it('steers with the stick or the d-pad, and lets the keyboard steer otherwise', () => {
    const reader = new PadReader();
    expect(reader.read(fakePad([], [0.6, 0])).steer).toBeCloseTo(0.5);
    expect(reader.read(fakePad([BUTTON.left], [0.6, 0])).steer).toBe(-1);
    expect(reader.read(fakePad()).steer).toBeNull();
    expect(reader.read(null).steer).toBeNull();
  });

  it('brakes with B, the left trigger or d-pad down', () => {
    const reader = new PadReader();
    expect(reader.read(fakePad([BUTTON.b])).brake).toBe(true);
    expect(reader.read(fakePad([], [0, 0], { [BUTTON.lt]: 0.4 })).brake).toBe(true);
    expect(reader.read(fakePad([], [0, 0], { [BUTTON.lt]: 0.1 })).brake).toBe(false);
    expect(reader.read(fakePad([BUTTON.down])).brake).toBe(true);
  });

  it('nitro, horn and pause fire once per press', () => {
    const reader = new PadReader();
    const first = reader.read(fakePad([BUTTON.a, BUTTON.y, BUTTON.start]));
    expect(first).toMatchObject({ nitro: true, horn: true, pause: true, confirm: true });
    expect(reader.read(fakePad([BUTTON.a, BUTTON.y, BUTTON.start]))).toMatchObject({ nitro: false, horn: false, pause: false, confirm: false });
    reader.read(fakePad());
    expect(reader.read(fakePad([BUTTON.rb])).nitro).toBe(true);
  });

  it('moves through menus with the d-pad or the stick', () => {
    const reader = new PadReader();
    expect(reader.read(fakePad([BUTTON.down])).move).toBe(1);
    expect(reader.read(fakePad([BUTTON.down])).move).toBe(0);
    reader.read(fakePad());
    expect(reader.read(fakePad([], [0, -0.9])).move).toBe(-1);
  });
});

describe('road to liberty: photo finish', () => {
  it('combos beat single commies; crashes are only the fallback', () => {
    const single = momentFor({ type: 'commie', who: 'marx', points: 500, combo: 1 })!;
    const combo = momentFor({ type: 'commie', who: 'stalin', points: 1500, combo: 4 })!;
    const crash = momentFor({ type: 'crash', kind: 'cruiser' })!;
    expect(combo.caption).toBe('COMBO ×4: STALIN FLATTENED');
    expect(single.caption).toBe('MARX FLATTENED');
    expect(combo.value).toBeGreaterThan(single.value);
    expect(single.value).toBeGreaterThan(crash.value);
    expect(crash.caption).toBe('RAMMED BY A CRUISER');
    expect(momentFor({ type: 'fuel' })).toBeNull();
  });

  it('flattening the tank is a photo to remember', () => {
    const best = bestMoment([
      { type: 'commie', who: 'marx', points: 500, combo: 2 },
      { type: 'boss-survived', kind: 'tank', bonus: 12000, smashed: true },
      { type: 'crash', kind: 'tank' },
    ]);
    expect(best?.caption).toBe('TANK FLATTENED BY A KILLDOZER');
    expect(bestMoment([{ type: 'rain' }])).toBeNull();
  });
});

describe('road to liberty: share card', () => {
  const run: RunSummary = {
    score: 123456.7,
    commies: 42,
    meters: 7340,
    landscape: 'the Beach',
    territory: 'Zug',
    car: 'Seized Trabant',
    carIcon: '🚙',
    daily: null,
    url: 'https://vb6enjoyer.github.io/lolbertarianism/vidya/road-to-liberty.html',
  };

  it('sums up the run in a few lines', () => {
    expect(shareText(run)).toBe([
      '🚗 The Road to Liberty',
      '💰 $123,456 before the State caught me',
      '☭ 42 commies flattened · 🛣️ 7.3 km',
      '🏞️ Reached the Beach (Zug) in the 🚙 Seized Trabant',
      run.url,
    ].join('\n'));
  });

  it('names the daily challenge, and one commie is a commie', () => {
    const text = shareText({ ...run, commies: 1, daily: { name: 'Stalin Day', icon: '🎖️', key: '2026-11-08' } });
    expect(text.split('\n')[0]).toBe('🚗 The Road to Liberty · 🎖️ Daily 2026-11-08 (Stalin Day)');
    expect(text).toContain('☭ 1 commie flattened');
  });
});

describe('road to liberty: accessibility options', () => {
  it('reduced motion on the system turns reduced flashing on and shake off', () => {
    expect(defaultOptions(true)).toEqual({ reducedFlashing: true, colorblind: false, shake: false });
    expect(defaultOptions(false)).toEqual({ reducedFlashing: false, colorblind: false, shake: true });
  });

  it('saves are cleaned up, falling back to the defaults', () => {
    expect(normalizeOptions({ colorblind: true, shake: 'yes' }, defaultOptions(false))).toEqual({ reducedFlashing: false, colorblind: true, shake: true });
    expect(normalizeOptions(null, defaultOptions(true))).toEqual(defaultOptions(true));
  });

  it('lights hold still with reduced flashing', () => {
    const frames = [0, 0.1, 0.2, 0.3].map((t) => blink(t, 5));
    expect(new Set(frames).size).toBe(2);
    display.reducedFlashing = true;
    expect([0, 0.1, 0.2, 0.3].every((t) => blink(t, 5))).toBe(true);
    display.reducedFlashing = false;
  });
});
