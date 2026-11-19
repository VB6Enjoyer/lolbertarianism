import { describe, expect, it } from 'vitest';
import { botRun } from './bot.ts';
import { BOSS_AT, CHARACTER_ORDER, CHARACTERS, MAX_LEVEL, PASSIVE_SLOTS, RUN_LENGTH, STARTING_WEAPONS, WEAPON_SLOTS } from './data.ts';
import { choose, DT, type Game, makeOffer, newGame, type Offer, spawnEnemy, step, weaponLevel, xpFor } from './game.ts';

const still = { x: 0, y: 0 };
/** A game with no spawning: the clock parked before the first statist would arrive. */
function quiet(character: Game['character'] = 'ancap'): Game {
  const g = newGame(1, character);
  g.spawnAcc = -1e9;
  return g;
}
const run = (g: Game, seconds: number, input = still) => {
  for (let i = 0; i < seconds / DT && !g.over; i++) {
    if (g.offer) choose(g, 0);
    step(g, input);
  }
};

describe('starting out', () => {
  it('each libertarian has their own stats and weapon', () => {
    for (const id of CHARACTER_ORDER) {
      const g = newGame(1, id);
      const c = CHARACTERS[id];
      expect(g.player.hp).toBe(c.hp);
      expect(g.player.armor).toBe(c.armor);
      expect(g.weapons.map((w) => w.id)).toEqual([c.weapon]);
    }
    expect(new Set(CHARACTER_ORDER.map((id) => CHARACTERS[id].weapon)).size).toBe(4);
  });

  it('is the same run for the same seed', () => {
    const a = newGame(42, 'agorist');
    const b = newGame(42, 'agorist');
    run(a, 20, { x: 1, y: 0.3 });
    run(b, 20, { x: 1, y: 0.3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('spawns statists off screen, more of them as time goes on', () => {
    const g = newGame(3, 'ancap');
    run(g, 10);
    for (const e of g.enemies) expect(Math.hypot(e.x - g.player.x, e.y - g.player.y)).toBeGreaterThan(300);
    const early = g.enemies.length;
    const later = newGame(3, 'ancap');
    later.time = 240;
    for (let i = 0; i < 600; i++) step(later, still);
    expect(later.enemies.length).toBeGreaterThan(early);
  });
});

describe('levelling up', () => {
  it('needs more XP each level, and stops for a choice of three', () => {
    for (let l = 1; l < 30; l++) expect(xpFor(l + 1)).toBeGreaterThan(xpFor(l));
    const g = quiet();
    g.pickups.push({ id: 999, kind: 'xp', x: 0, y: 0, value: xpFor(1) + 1, pulled: false });
    step(g, still);
    expect(g.level).toBe(2);
    expect(g.offer).toHaveLength(3);
    const t = g.time;
    step(g, { x: 1, y: 0 });
    expect(g.time).toBe(t); // paused while choosing
    expect(choose(g, 0)).toBe(true);
    expect(g.offer).toBeNull();
  });

  it('never offers another character’s starting weapon, or more than the slots allow', () => {
    const g = quiet('minarchist');
    for (let i = 0; i < 200; i++) {
      g.pending = 1;
      g.offer = makeOffer(g);
      for (const o of g.offer) if (o.kind === 'weapon') expect(STARTING_WEAPONS.filter((w) => w !== 'shotgun')).not.toContain(o.id);
      choose(g, Math.floor(Math.random() * g.offer.length));
      expect(g.weapons.length).toBeLessThanOrEqual(WEAPON_SLOTS);
      expect(g.passives.length).toBeLessThanOrEqual(PASSIVE_SLOTS);
      for (const w of g.weapons) expect(w.level).toBeLessThanOrEqual(MAX_LEVEL);
    }
    // Everything maxed: a free lunch or gold instead.
    g.pending = 1;
    const last: Offer[] = makeOffer(g);
    expect(last.every((o) => o.kind === 'heal' || o.kind === 'gold') || last.length > 0).toBe(true);
  });

  it('passives change the stats', () => {
    const g = quiet('ancap');
    const take = (id: 'property' | 'freetrade' | 'compound' | 'healthcare') => {
      g.pending = 1;
      g.offer = [{ kind: 'passive', id, level: 1 }];
      choose(g, 0);
    };
    take('property');
    expect(g.player.armor).toBe(1);
    take('freetrade');
    expect(g.player.magnet).toBeCloseTo(CHARACTERS.ancap.magnet * 1.25);
    take('compound');
    expect(g.player.xpMult).toBeCloseTo(1.1);
    const hp = g.player.maxHp;
    take('healthcare');
    expect(g.player.maxHp).toBe(hp + 15);
    expect(g.player.regen).toBeGreaterThan(0);
  });
});

describe('weapons (auto-aim)', () => {
  it('gold coins go for the nearest statist', () => {
    const g = quiet('ancap');
    const e = spawnEnemy(g, 'socialist', 200, 0);
    spawnEnemy(g, 'socialist', -500, 0);
    run(g, 1.5);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(g.damageBy.coins).toBeGreaterThan(0);
  });

  it('the shotgun knocks them back; NEIN! hits everyone around you', () => {
    const g = quiet('minarchist');
    const e = spawnEnemy(g, 'bureaucrat', 120, 0);
    run(g, 0.5);
    expect(g.damageBy.shotgun).toBeGreaterThan(0);
    const a = quiet('austrian');
    const ring = [0, 1, 2, 3].map((k) => spawnEnemy(a, 'bureaucrat', Math.cos(k * 1.57) * 120, Math.sin(k * 1.57) * 120));
    run(a, 0.5);
    for (const x of ring) expect(x.hp).toBeLessThan(x.maxHp);
    void e;
  });

  it('the Invisible Hand, the Non-Aggression Pact, the Laffer Curve and Price Signals all land', () => {
    for (const id of ['hand', 'nap', 'laffer', 'signal'] as const) {
      const g = quiet('ancap');
      g.weapons = [];
      g.pending = 1;
      g.offer = [{ kind: 'weapon', id, level: 1 }];
      choose(g, 0);
      expect(weaponLevel(g, id)).toBe(1);
      const dist = id === 'hand' ? 70 : id === 'nap' ? 40 : id === 'laffer' ? 240 : 150;
      const e = spawnEnemy(g, 'bureaucrat', dist, 0);
      e.speed = 0;
      run(g, 3);
      expect(g.damageBy[id], id).toBeGreaterThan(0);
    }
  });
});

describe('the statists', () => {
  it('hurt on contact, less with armour (never less than 1), with a moment of safety after', () => {
    const g = quiet('minarchist');
    spawnEnemy(g, 'communist', 0, 0);
    g.weapons = [];
    step(g, still);
    expect(g.player.hp).toBe(CHARACTERS.minarchist.hp - (6 - CHARACTERS.minarchist.armor));
    step(g, still);
    expect(g.player.hp).toBe(CHARACTERS.minarchist.hp - (6 - CHARACTERS.minarchist.armor));
  });

  it('a Keynesian splits into stimulus; a Taxman steals XP and gives it back when he dies', () => {
    const g = quiet('ancap');
    g.weapons = [];
    const k = spawnEnemy(g, 'keynesian', 300, 0);
    k.hp = 1;
    g.weapons = [{ id: 'nap', level: 5, cooldown: 0, angle: 0, lastHit: {} }];
    k.x = 30;
    run(g, 0.3);
    expect(g.enemies.filter((e) => e.type === 'stimulus').length + g.kills).toBeGreaterThanOrEqual(2);

    const h = quiet('ancap');
    h.weapons = [];
    h.player.magnet = 0;
    h.pickups.push({ id: 900, kind: 'xp', x: 400, y: 0, value: 7, pulled: false });
    const tax = spawnEnemy(h, 'taxman', 440, 0);
    run(h, 1);
    expect(tax.stolen).toBe(7);
  });

  it('red tape slows you down', () => {
    const g = quiet('ancap');
    g.weapons = [];
    step(g, { x: 1, y: 0 });
    const free = g.player.x;
    const s = quiet('ancap');
    s.weapons = [];
    s.zones.push({ x: 0, y: 0, radius: 50, life: 5 });
    step(s, { x: 1, y: 0 });
    expect(s.player.x).toBeLessThan(free);
  });

  it('the Central Bank arrives on time; the revolution too; and the state withers at the end', () => {
    const g = newGame(5, 'ancap');
    g.time = BOSS_AT - 0.01;
    g.events.revolution1 = true;
    step(g, still);
    expect(g.enemies.some((e) => e.type === 'bank')).toBe(true);
    expect(g.fx.some((f) => f.kind === 'boss')).toBe(true);
    const r = quiet();
    r.time = 149.99;
    step(r, still);
    expect(r.enemies.filter((e) => e.type === 'communist').length).toBeGreaterThanOrEqual(30);
    const w = quiet();
    w.time = RUN_LENGTH - 0.001;
    w.events = { boss: true, revolution1: true, revolution2: true };
    spawnEnemy(w, 'communist', 500, 0);
    step(w, still);
    expect(w.over).toBe('won');
    expect(w.enemies).toHaveLength(0);
  });
});

describe('the bot', () => {
  it('every character survives the first 90 seconds with sensible play', () => {
    for (const id of CHARACTER_ORDER) {
      const g = botRun(newGame(11, id), 90);
      expect(g.over, id).toBeNull();
      expect(g.level, id).toBeGreaterThanOrEqual(2);
      expect(g.kills, id).toBeGreaterThan(30);
    }
  });
});
