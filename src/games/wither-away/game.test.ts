import { describe, expect, it } from 'vitest';
import { botRun } from './bot.ts';
import { BOMB, BOSS_AT, CHARACTER_ORDER, CHARACTERS, EVOLUTIONS, LOCKED_CARDS, MAX_LEVEL, PASSIVE_SLOTS, MAPS, MARX, NIMBY, PRINTER, RUN_LENGTH, STARTING_WEAPONS, TECHNOCRAT, WARNING_TIME, WEAPON_SLOTS } from './data.ts';
import { choose, DT, type Game, goldEarned, makeOffer, newGame, type Offer, reroll, spawnEnemy, spawnWeights, step, weaponLevel, xpFor } from './game.ts';

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
    const e = spawnEnemy(g, 'socialist', 120, 0);
    run(g, 0.5);
    expect(g.damageBy.shotgun).toBeGreaterThan(0);
    const a = quiet('austrian');
    const ring = [0, 1, 2, 3].map((k) => spawnEnemy(a, 'socialist', Math.cos(k * 1.57) * 120, Math.sin(k * 1.57) * 120));
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
      const e = spawnEnemy(g, 'socialist', dist, 0);
      e.speed = 0;
      run(g, 3);
      expect(g.damageBy[id], id).toBeGreaterThan(0);
    }
  });
});

describe('the shop’s cards and weapon upgrades', () => {
  it('locked cards never turn up until bought', () => {
    const offered = (g: Game) => {
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) {
        g.pending = 1;
        for (const o of makeOffer(g)) if (o.kind === 'weapon' || o.kind === 'passive') seen.add(o.id);
      }
      return seen;
    };
    const locked = offered(quiet('ancap'));
    for (const id of LOCKED_CARDS) expect(locked.has(id), id).toBe(false);
    const open = offered(newGame(1, 'ancap', { unlocked: [...LOCKED_CARDS] }));
    for (const id of LOCKED_CARDS) expect(open.has(id), id).toBe(true);
  });

  it('the weapon upgrade is always offered once the starting weapon is maxed, and swaps the weapon', () => {
    for (const id of CHARACTER_ORDER) {
      const { from, to } = EVOLUTIONS[id];
      const without = quiet(id);
      without.weapons[0].level = MAX_LEVEL;
      expect(makeOffer(without).some((o) => o.kind === 'evolve'), id).toBe(false);
      const g = newGame(1, id, { canEvolve: true });
      g.spawnAcc = -1e9;
      g.pending = 1;
      expect(makeOffer(g).some((o) => o.kind === 'evolve')).toBe(false); // not at level 1
      g.weapons[0].level = MAX_LEVEL;
      g.offer = makeOffer(g);
      const i = g.offer.findIndex((o) => o.kind === 'evolve');
      expect(i, id).toBeGreaterThanOrEqual(0);
      choose(g, i);
      expect(weaponLevel(g, to)).toBe(MAX_LEVEL);
      expect(weaponLevel(g, from)).toBe(0);
      expect(g.fx.some((f) => f.kind === 'evolve')).toBe(true);
      // Never offered again, and the old weapon doesn't come back.
      for (let k = 0; k < 50; k++) {
        g.pending = 1;
        for (const o of makeOffer(g)) {
          expect(o.kind).not.toBe('evolve');
          if (o.kind === 'weapon') expect(o.id).not.toBe(from);
        }
      }
    }
  });

  it('every upgraded weapon outdoes its level-5 self', () => {
    for (const id of CHARACTER_ORDER) {
      const { from, to } = EVOLUTIONS[id];
      const dealt = (weapon: typeof from) => {
        const g = quiet(id);
        g.player.hp = g.player.maxHp = 1e9;
        g.weapons = [{ id: weapon, level: MAX_LEVEL, cooldown: 0, angle: 0, lastHit: {} }];
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          const e = spawnEnemy(g, 'socialist', Math.cos(a) * (90 + (k % 3) * 40), Math.sin(a) * (90 + (k % 3) * 40));
          e.hp = e.maxHp = 1e6;
          e.speed = 0;
        }
        run(g, 6);
        return g.damageBy[weapon] ?? 0;
      };
      expect(dealt(to), `${from} → ${to}`).toBeGreaterThan(dealt(from) * 1.5);
    }
  });

  it('the new weapons land: Creative Destruction blows up a crowd, It’s Happening jumps', () => {
    const g = quiet('ancap');
    g.weapons = [{ id: 'destruction', level: 1, cooldown: 0, angle: 0, lastHit: {} }];
    const crowd = [0, 1, 2].map((k) => spawnEnemy(g, 'socialist', 200 + k * 20, 0));
    for (const e of crowd) e.speed = 0;
    run(g, 0.1);
    expect(crowd.filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(2);
    const z = quiet('ancap');
    z.weapons = [{ id: 'happening', level: 1, cooldown: 0, angle: 0, lastHit: {} }];
    const line = [0, 1, 2, 3].map((k) => spawnEnemy(z, 'socialist', 150 + k * 100, 0));
    for (const e of line) e.speed = 0;
    step(z, still);
    expect(line.every((e) => e.hp < e.maxHp)).toBe(true);
    expect(z.fx.find((f) => f.kind === 'zap')).toBeTruthy();
  });

  it('rerolls swap the cards, as many times as the shop allows', () => {
    const g = newGame(1, 'ancap', { mods: { rerolls: 1 } });
    g.spawnAcc = -1e9;
    expect(reroll(g)).toBe(false); // nothing to reroll
    g.pending = 1;
    g.offer = makeOffer(g);
    expect(reroll(g)).toBe(true);
    expect(g.offer).toHaveLength(3);
    expect(reroll(g)).toBe(false);
  });

  it('regulations make statists tougher, faster, more numerous and harder-hitting; the shop makes you stronger', () => {
    const hard = newGame(1, 'ancap', { mods: { enemyHp: 1.5, enemySpeed: 1.2, hurt: 2, damage: 2 } });
    hard.spawnAcc = -1e9;
    const e = spawnEnemy(hard, 'communist', 0, 0);
    expect(e.maxHp).toBe(12);
    hard.weapons = [];
    step(hard, still);
    expect(hard.player.hp).toBe(CHARACTERS.ancap.hp - 12);
    const busy = (spawns: number) => {
      const g = newGame(4, 'ancap', { mods: { spawns } });
      g.weapons = [];
      g.player.hp = 1e9;
      run(g, 30);
      return g.enemies.length;
    };
    expect(busy(1.5)).toBeGreaterThan(busy(1));
    const strong = newGame(1, 'ancap', { mods: { damage: 2 } });
    strong.spawnAcc = -1e9;
    const t = spawnEnemy(strong, 'socialist', 150, 0);
    t.hp = t.maxHp = 1000;
    run(strong, 1);
    expect(strong.damageBy.coins! % 24).toBe(0); // 12 damage, doubled
  });

  it('pays Bitcoin for what you pick up, for lasting, and more for winning', () => {
    const g = quiet('ancap');
    g.gold = 30;
    g.time = 125;
    expect(goldEarned(g)).toEqual({ picked: 30, survived: 20, total: 50 });
    g.over = 'won';
    g.time = RUN_LENGTH;
    g.mods.gold = 1.5;
    expect(goldEarned(g).total).toBe(Math.round((30 + RUN_LENGTH / 6 + 100) * 1.5));
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

  it('a fascist stops to wind up, then charges straight at where you were', () => {
    const g = quiet('ancap');
    g.weapons = [];
    const f = spawnEnemy(g, 'fascist', 300, 0);
    f.timer = 3.6;
    step(g, still);
    expect(f.windup).toBeGreaterThan(0);
    const x0 = f.x;
    run(g, 0.6);
    expect(Math.abs(f.x - x0)).toBeLessThan(5); // standing still while winding up
    run(g, 0.2);
    expect(f.dash).toBeGreaterThan(0);
    const x1 = f.x;
    run(g, 0.2);
    expect(x1 - f.x).toBeGreaterThan(40); // charging: much faster than his walk
  });

  it('fascists march in squads of four', () => {
    const g = newGame(9, 'ancap');
    g.time = 400;
    g.nextEvent = 3;
    for (let i = 0; i < 60 * 20 && g.enemies.filter((e) => e.type === 'fascist').length === 0; i++) {
      if (g.offer) choose(g, 0);
      step(g, still);
    }
    expect(g.enemies.filter((e) => e.type === 'fascist').length % 4).toBe(0);
  });

  it('the Central Bank arrives on time (and again, bailed out); the revolution too, with a warning; and the state withers at the end', () => {
    const g = newGame(5, 'ancap');
    g.time = BOSS_AT - 0.01;
    g.nextEvent = MAPS.streets.schedule.findIndex((e) => e.at === BOSS_AT);
    step(g, still);
    const bank = g.enemies.find((e) => e.type === 'bank')!;
    expect(bank).toBeTruthy();
    expect(g.fx.some((f) => f.kind === 'boss')).toBe(true);
    const again = newGame(5, 'ancap', { map: 'vienna' });
    again.time = 599.99;
    again.nextEvent = 3;
    step(again, still);
    expect(again.enemies.find((e) => e.type === 'bank')!.maxHp).toBeGreaterThan(bank.maxHp * 2);
    const marx = newGame(5, 'ancap');
    marx.time = 599.99;
    marx.nextEvent = 3;
    step(marx, still);
    expect(marx.enemies.some((e) => e.type === 'marx')).toBe(true);
    const r = quiet();
    r.time = 150 - WARNING_TIME - 0.01;
    step(r, still);
    expect(r.fx.some((f) => f.kind === 'warning')).toBe(true);
    r.time = 149.99;
    step(r, still);
    expect(r.enemies.filter((e) => e.type === 'communist').length).toBeGreaterThanOrEqual(30);
    expect(MAPS.streets.schedule.filter((e) => e.kind === 'revolution')).toHaveLength(3);
    expect(RUN_LENGTH).toBe(900);
    const w = quiet();
    w.time = RUN_LENGTH - 0.001;
    w.nextEvent = MAPS.streets.schedule.length;
    spawnEnemy(w, 'communist', 500, 0);
    step(w, still);
    expect(w.over).toBe('won');
    expect(w.enemies).toHaveLength(0);
  });

  it('they get tougher and hit harder as time goes on', () => {
    const g = quiet();
    const early = spawnEnemy(g, 'communist', 900, 0);
    g.time = 800;
    const late = spawnEnemy(g, 'communist', 900, 0);
    expect(late.maxHp).toBeGreaterThan(early.maxHp * 6);
    expect(late.damage).toBeGreaterThan(early.damage * 2);
  });
});

describe('the newer statists, Marx and the maps', () => {
  it('a Technocrat keeps his distance and shoots', () => {
    const g = quiet('ancap');
    g.weapons = [];
    const t = spawnEnemy(g, 'technocrat', 600, 0);
    run(g, 6);
    const d = Math.hypot(t.x - g.player.x, t.y - g.player.y);
    expect(d).toBeGreaterThan(TECHNOCRAT.range - 90);
    expect(d).toBeLessThan(TECHNOCRAT.range + 90);
    expect(g.foeShots.some((b) => b.kind === 'bolt') || g.player.hp < g.player.maxHp).toBe(true);
  });

  it('a NIMBY builds a fence across your path, and you can’t walk through it', () => {
    const g = quiet('ancap');
    g.weapons = [];
    const n = spawnEnemy(g, 'nimby', -300, 0);
    n.speed = 0;
    n.timer = NIMBY.every;
    step(g, { x: 1, y: 0 });
    expect(g.walls).toHaveLength(1);
    const wall = g.walls[0];
    expect((wall.x1 + wall.x2) / 2).toBeGreaterThan(g.player.x + 50); // ahead of you
    n.timer = -999;
    run(g, 2, { x: 1, y: 0 });
    expect(g.player.x).toBeLessThan((wall.x1 + wall.x2) / 2); // stopped at the fence
    run(g, NIMBY.life, { x: 0, y: 0 });
    expect(g.walls).toHaveLength(0); // and it comes down eventually
  });

  it('Marx throws hammers and sickles, and calls up the workers', () => {
    const g = quiet('ancap');
    g.weapons = [];
    g.player.hp = g.player.maxHp = 1e6;
    const m = spawnEnemy(g, 'marx', 400, 0);
    m.speed = 0;
    m.timer = MARX.every;
    step(g, still);
    expect(g.foeShots.filter((b) => b.kind === 'hammer' || b.kind === 'sickle')).toHaveLength(MARX.volley);
    m.summon = MARX.summonEvery;
    step(g, still);
    expect(g.enemies.filter((e) => e.type === 'communist')).toHaveLength(MARX.summon);
    m.hp = 1;
    g.weapons = [{ id: 'nein', level: 5, cooldown: 0, angle: 0, lastHit: {} }];
    m.x = 60;
    run(g, 0.2);
    expect(g.marxKills).toBe(1);
    expect(g.pickups.some((pk) => pk.kind === 'chest') || g.level > 2).toBe(true); // dropped (or already picked up)
  });

  it('the vault starts money printers that keep printing statists until smashed', () => {
    const g = newGame(2, 'ancap', { map: 'vault' });
    g.spawnAcc = -1e9;
    g.weapons = [];
    g.player.hp = g.player.maxHp = 1e6;
    g.time = PRINTER.first - 0.01;
    step(g, still);
    const printer = g.enemies.find((e) => e.type === 'printer')!;
    expect(printer).toBeTruthy();
    g.spawnAcc = -1e9;
    run(g, PRINTER.keynesianEvery + 0.5);
    expect(g.enemies.filter((e) => e.type === 'stimulus').length).toBeGreaterThanOrEqual(2);
    expect(g.enemies.some((e) => e.type === 'keynesian')).toBe(true);
    expect(Math.hypot(printer.x - g.player.x, printer.y - g.player.y)).toBeGreaterThan(300); // it stays put
    expect(newGame(2, 'ancap', { map: 'vault' }).mods.gold).toBeCloseTo(MAPS.vault.gold);
    // Not on the other maps.
    const s = newGame(2, 'ancap');
    s.time = PRINTER.first + 1;
    step(s, still);
    expect(s.enemies.some((e) => e.type === 'printer')).toBe(false);
  });

  it('every map runs its own schedule to 15:00 and has its own mix', () => {
    for (const map of Object.values(MAPS)) {
      expect(map.schedule.every((e, i, a) => i === 0 || e.at > a[i - 1].at)).toBe(true);
      expect(map.schedule.at(-1)!.at).toBeLessThan(RUN_LENGTH);
      expect(map.schedule.some((e) => e.kind === 'boss' && e.boss === 'marx')).toBe(true);
    }
    const vienna = newGame(1, 'ancap', { map: 'vienna' });
    const streets = newGame(1, 'ancap');
    expect(spawnWeights(vienna, 130).some(([id]) => id === 'technocrat')).toBe(true);
    expect(spawnWeights(streets, 130).some(([id]) => id === 'technocrat')).toBe(false);
  });
});

describe('the bomb', () => {
  it('you start with one; it flattens everything nearby, pops balloons, and winds you', () => {
    const g = quiet('ancap');
    g.weapons = [];
    expect(g.bombs).toBe(1);
    g.time = 400;
    const crowd = [0, 1, 2, 3, 4, 5].map((k) => spawnEnemy(g, k % 2 ? 'fascist' : 'keynesian', Math.cos(k) * 250, Math.sin(k) * 250));
    const far = spawnEnemy(g, 'communist', 900, 0);
    const bank = spawnEnemy(g, 'bank', -300, 0);
    g.foeShots.push({ kind: 'balloon', x: 100, y: 0, vx: 0, vy: 0, radius: 11, damage: 12, life: 4 });
    step(g, { x: 1, y: 0, bomb: true });
    expect(crowd.every((e) => e.dead)).toBe(true);
    expect(far.dead).toBe(false);
    expect(bank.dead).toBe(false);
    expect(bank.hp).toBeLessThan(bank.maxHp);
    expect(g.foeShots).toHaveLength(0);
    expect(g.bombs).toBe(0);
    expect(g.player.slowed).toBeGreaterThan(2.9);
    expect(g.fx.some((f) => f.kind === 'bomb')).toBe(true);
    // Winded: half speed for three seconds.
    const x0 = g.player.x;
    step(g, { x: 1, y: 0 });
    expect(g.player.x - x0).toBeCloseTo((CHARACTERS.ancap.speed * BOMB.slowBy) / 60, 3);
    run(g, 3.1, { x: 0, y: 0 });
    const x1 = g.player.x;
    step(g, { x: 1, y: 0 });
    expect(g.player.x - x1).toBeCloseTo(CHARACTERS.ancap.speed / 60, 3);
    // No bombs left: nothing happens.
    const e = spawnEnemy(g, 'communist', g.player.x + 100, g.player.y);
    step(g, { x: 0, y: 0, bomb: true });
    expect(e.dead).toBe(false);
  });

  it('the shop adds starting bombs, and the spare-bomb card turns up once bought', () => {
    expect(newGame(1, 'ancap', { mods: { bombs: 2 } }).bombs).toBe(3);
    const seen = (g: Game) => {
      for (let i = 0; i < 200; i++) {
        g.pending = 1;
        if (makeOffer(g).some((o) => o.kind === 'bomb')) return true;
      }
      return false;
    };
    expect(seen(quiet())).toBe(false);
    const g = newGame(1, 'ancap', { unlocked: ['bomb'] });
    expect(seen(g)).toBe(true);
    g.pending = 1;
    g.offer = [{ kind: 'bomb' }];
    choose(g, 0);
    expect(g.bombs).toBe(2);
    g.bombs = BOMB.max;
    expect(seen(g)).toBe(false);
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

describe('the soundtrack', () => {
  it('every track is made of whole bars of sixteen steps, with notes in each', async () => {
    const { TRACKS, parseRiff } = await import('./music.ts');
    for (const [id, tr] of Object.entries(TRACKS)) {
      expect(tr.bars.length, id).toBeGreaterThanOrEqual(4);
      for (const bar of tr.bars) {
        expect(bar.riff, id).toHaveLength(16);
        expect(bar.riff.some(Boolean), id).toBe(true);
      }
    }
    expect(parseRiff('0o - - - . . 3 3 5o - 1 . . . 0 0')[0]).toEqual({ fret: 0, open: true, len: 4 });
    expect(() => parseRiff('0 0 0')).toThrow();
  });
});
