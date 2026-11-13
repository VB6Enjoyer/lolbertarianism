import { describe, expect, it } from 'vitest';
import { build, CONFIG, handPosition, multiplier, newGame, nextWave, slap, spawnHand, step, traderShare, type GameState, type Hand } from './logic.ts';
import { attraction, GLUE_SECONDS, GUARD_WAGES, LEMONADE_EVERY } from './capital.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Moves a hand all the way to the pile. */
function reach(s: GameState, hand: Hand, r = rng(1)) {
  for (let i = 0; i < 1000 && hand.state === 'reaching' && s.phase === 'playing'; i++) step(s, 0.02, r);
}

const quiet = (s: GameState) => {
  // No more spawning or homesteading during a test.
  s.spawnIn = 1e9;
  s.homesteadIn = 1e9;
  return s;
};

describe('kindergarten: thieves', () => {
  it('a thief that reaches the pile takes a block; slapping it on the way out gets it back', () => {
    const s = quiet(newGame(1000, 600));
    const hand = spawnHand(s, rng(2), 'thief');
    reach(s, hand);
    expect(s.blocks).toBe(CONFIG.startBlocks - 1);
    expect(hand.carrying).toBe(1);
    step(s, 0.05, rng(3));
    const at = handPosition(hand);
    expect(slap(s, at.x, at.y)).toBe(hand);
    expect(s.blocks).toBe(CONFIG.startBlocks);
    expect(s.events.some((e) => e.type === 'recover')).toBe(true);
  });

  it('slapping a thief scores, and a combo multiplies it', () => {
    const s = quiet(newGame(1000, 600));
    for (let i = 0; i < 6; i++) {
      const hand = spawnHand(s, rng(10 + i), 'thief');
      hand.progress = 0.5;
      const at = handPosition(hand);
      slap(s, at.x, at.y);
    }
    expect(s.combo).toBe(6);
    expect(s.stats.slapped).toBe(6);
    expect(s.score).toBe(CONFIG.slapPoints * 4 + CONFIG.slapPoints * 2 * 2);
    expect(multiplier(10)).toBe(3);
    // A whiff breaks the combo.
    slap(s, -999, -999);
    expect(s.combo).toBe(0);
  });

  it('lose every block and the property is seized', () => {
    const s = quiet(newGame(1000, 600));
    s.blocks = 1;
    reach(s, spawnHand(s, rng(4), 'thief'));
    expect(s.phase).toBe('over');
    expect(s.over).toBe('seized');
  });
});

describe('kindergarten: traders', () => {
  it('a trader that reaches the pile trades: blocks for an item, worth more than it cost', () => {
    const s = quiet(newGame(1000, 600));
    const hand = spawnHand(s, rng(5), 'trader');
    const offer = hand.offer!;
    expect(offer.value).toBeGreaterThan(offer.price);
    reach(s, hand);
    expect(offer.wants).toBe('blocks');
    expect(s.blocks).toBe(CONFIG.startBlocks - offer.price);
    expect(s.stash).toEqual([{ item: offer.item, cost: offer.price }]);
    expect(s.score).toBe(Math.round(offer.value * CONFIG.tradePoints));
  });

  it('a classmate buying something you own pays more than you paid for it', () => {
    const s = quiet(newGame(1000, 600));
    s.stash = [{ item: 'dino', cost: 2 }];
    let hand = spawnHand(s, rng(6), 'trader');
    for (let k = 0; hand.offer!.wants !== 'item' && k < 20; k++) {
      s.hands = [];
      hand = spawnHand(s, rng(60 + k), 'trader');
    }
    expect(hand.offer).toMatchObject({ wants: 'item', item: 'dino' });
    expect(hand.offer!.price).toBeGreaterThan(2);
    const before = s.blocks;
    reach(s, hand);
    expect(s.blocks).toBe(before + hand.offer!.price);
    expect(s.stash).toEqual([]);
  });

  it('slapping a trader is aggression: it costs a gold star, and losing them all gets you expelled', () => {
    const s = quiet(newGame(1000, 600));
    for (let i = 0; i < CONFIG.maxStars; i++) {
      const hand = spawnHand(s, rng(20 + i), 'trader');
      hand.progress = 0.4;
      const at = handPosition(hand);
      slap(s, at.x, at.y);
    }
    expect(s.stats.violations).toBe(CONFIG.maxStars);
    expect(s.over).toBe('expelled');
  });

  it('good trades win a star back; a broke Jack can’t trade', () => {
    const s = quiet(newGame(1000, 600));
    s.stars = 3;
    s.blocks = 30;
    for (let i = 0; i < CONFIG.tradesPerStar; i++) reach(s, spawnHand(s, rng(30 + i), 'trader'));
    expect(s.stars).toBe(4);
    s.blocks = 0;
    s.stash = [];
    s.phase = 'playing';
    const broke = spawnHand(s, rng(40), 'trader');
    reach(s, broke);
    expect(broke.traded).toBe(false);
    expect(s.events.some((e) => e.type === 'broke')).toBe(true);
  });

  it('slapping traders makes classmates less likely to come', () => {
    expect(traderShare(5)).toBeGreaterThan(traderShare(1) * 2);
  });
});

describe('kindergarten: waves', () => {
  it('a wave spawns hands for its length, then ends with a bonus for the blocks left', () => {
    const s = newGame(1000, 600);
    const r = rng(7);
    // Let everything through: trades and thefts both happen; slap nothing.
    for (let t = 0; t < CONFIG.waveLength + 15 && s.phase === 'playing'; t += 0.05) step(s, 0.05, r);
    if (s.phase === 'over') return; // Possible (the thieves won), but not the point here.
    expect(s.phase).toBe('break');
    const end = s.events.find((e) => e.type === 'wave-end');
    expect(end && end.type === 'wave-end' && end.bonus).toBe(s.blocks * CONFIG.waveBonusPerBlock);
    nextWave(s);
    expect(s.wave).toBe(2);
    expect(s.phase).toBe('playing');
  });

  it('a slapping-perfect player survives several waves', () => {
    const s = newGame(1000, 600);
    const r = rng(9);
    for (let wave = 0; wave < 4; wave++) {
      for (let t = 0; t < 80 && s.phase === 'playing'; t += 0.05) {
        step(s, 0.05, r);
        for (const hand of s.hands) {
          if (hand.kind === 'thief' && !hand.slapped && hand.progress > 0.5) {
            const at = handPosition(hand);
            slap(s, at.x, at.y);
          }
        }
      }
      expect(s.phase).toBe('break');
      nextWave(s);
    }
    expect(s.stats.violations).toBe(0);
    expect(s.stats.trades).toBeGreaterThan(5);
    expect(s.blocks).toBeGreaterThan(5);
  });
});

describe('kindergarten: capital', () => {
  const atRecess = () => {
    const s = quiet(newGame(1000, 600));
    s.phase = 'break';
    s.blocks = 50;
    return s;
  };

  it('builds at recess, keeps a block back, and stops at the top level', () => {
    const s = atRecess();
    expect(build(s, 'lemonade')).toBe(true);
    expect(s.built.lemonade).toBe(1);
    expect(s.blocks).toBe(44);
    expect(build(s, 'lemonade') && build(s, 'lemonade')).toBe(true);
    expect(build(s, 'lemonade')).toBe(false);
    s.blocks = 6;
    expect(build(s, 'flag')).toBe(false); // would leave nothing
    s.phase = 'playing';
    s.blocks = 50;
    expect(build(s, 'sign')).toBe(false); // not mid-wave
  });

  it('the lemonade stand makes blocks', () => {
    const s = atRecess();
    build(s, 'lemonade');
    nextWave(s);
    s.homesteadIn = 1e9;
    s.spawnIn = 1e9;
    const before = s.blocks;
    for (let t = 0; t < LEMONADE_EVERY[0] * 2 + 0.1; t += 0.05) step(s, 0.05, rng(1));
    expect(s.blocks).toBe(before + 2);
  });

  it('a sign slows thieves, the glue holds them, the flag scares some off', () => {
    const plain = quiet(newGame(1000, 600));
    const slow = atRecess();
    build(slow, 'sign');
    build(slow, 'glue');
    nextWave(slow);
    quiet(slow);
    slow.wave = 1;
    expect(spawnHand(slow, rng(3), 'thief').travel).toBeGreaterThan(spawnHand(plain, rng(3), 'thief').travel * 1.1);
    const hand = slow.hands[0];
    let stuck = 0;
    for (let i = 0; i < 400 && hand.state === 'reaching'; i++) {
      step(slow, 0.02, rng(4));
      if (hand.glued > 0) stuck += 0.02;
    }
    expect(stuck).toBeGreaterThan(GLUE_SECONDS[0] * 0.8);
    // The flag: with the top level, about a third turn back.
    const flagged = atRecess();
    build(flagged, 'flag');
    build(flagged, 'flag');
    build(flagged, 'flag');
    nextWave(flagged);
    quiet(flagged);
    const r = rng(5);
    for (let i = 0; i < 300; i++) spawnHand(flagged, r, 'thief');
    for (let t = 0; t < 3; t += 0.05) step(flagged, 0.05, r);
    const scared = flagged.events.filter((e) => e.type === 'scared').length;
    expect(scared).toBeGreaterThan(70);
    expect(scared).toBeLessThan(150);
  });

  it('hired security slaps thieves, and wants paying every recess (or quits)', () => {
    const s = atRecess();
    build(s, 'guard');
    nextWave(s);
    quiet(s);
    s.guardIn = 0;
    const hand = spawnHand(s, rng(6), 'thief');
    hand.progress = 0.6;
    step(s, 0.02, rng(7));
    expect(hand.slapped).toBe(true);
    expect(s.events.some((e) => e.type === 'guard')).toBe(true);
    // End the wave: wages come out.
    s.hands = [];
    s.waveTime = CONFIG.waveLength;
    const before = s.blocks;
    step(s, 0.02, rng(8));
    expect(s.phase).toBe('break');
    expect(s.blocks).toBe(before - GUARD_WAGES[0]);
    // Can't pay: the kid quits.
    nextWave(s);
    s.hands = [];
    s.waveTime = CONFIG.waveLength;
    s.blocks = 1;
    step(s, 0.02, rng(9));
    expect(s.built.guard).toBe(0);
  });

  it('the piggy bank pays interest at recess; a big pile draws more hands', () => {
    const s = atRecess();
    build(s, 'piggy');
    nextWave(s);
    quiet(s);
    s.blocks = 30;
    s.waveTime = CONFIG.waveLength;
    step(s, 0.02, rng(10));
    expect(s.blocks).toBe(33);
    expect(attraction(45)).toBeGreaterThan(1.4);
    expect(attraction(10)).toBe(1);
  });
});

describe('kindergarten: the cast', () => {
  it('the Hall Monitor takes three slaps, each knocking it back', () => {
    const s = quiet(newGame(1000, 600));
    const hand = spawnHand(s, rng(11), 'thief', 'monitor');
    hand.progress = 0.7;
    for (let i = 0; i < 2; i++) {
      hand.stun = 0;
      const at = handPosition(hand);
      slap(s, at.x, at.y);
      expect(hand.slapped).toBe(false);
    }
    expect(hand.hp).toBe(1);
    expect(hand.progress).toBeLessThan(0.4);
    const at = handPosition(hand);
    slap(s, at.x, at.y);
    expect(hand.slapped).toBe(true);
  });

  it('the Class President taxes 10%, the Principal takes 30%', () => {
    const s = quiet(newGame(1000, 600));
    s.blocks = 40;
    reach(s, spawnHand(s, rng(12), 'thief', 'president'));
    expect(s.blocks).toBe(36);
    reach(s, spawnHand(s, rng(13), 'thief', 'principal'));
    expect(s.blocks).toBe(36 - Math.ceil(36 * 0.3));
  });

  it('the Monopoly-money kid looks like a trade, but slapping it is fine (fraud is aggression)', () => {
    const s = quiet(newGame(1000, 600));
    const fraud = spawnHand(s, rng(14), 'thief', 'fraud');
    expect(fraud.offer).toMatchObject({ item: 'money' });
    fraud.progress = 0.5;
    const at = handPosition(fraud);
    slap(s, at.x, at.y);
    expect(s.stars).toBe(CONFIG.maxStars);
    expect(s.stats.violations).toBe(0);
    // Let one through: it takes its "price" and leaves nothing.
    const before = s.blocks;
    const second = spawnHand(s, rng(15), 'thief', 'fraud');
    reach(s, second);
    expect(s.blocks).toBe(before - second.offer!.price);
    expect(s.stash).toEqual([]);
  });

  it('a new troublemaker each day of the first week', async () => {
    const { rolesOn, newToday, pickRole } = await import('./school.ts');
    expect(rolesOn(1).map((r) => r.id)).toEqual(['grabby']);
    expect(newToday(2).map((r) => r.id)).toEqual(['monitor']);
    expect(newToday(4).map((r) => r.id)).toEqual(['president', 'fraud']);
    expect(rolesOn(4).map((r) => r.id)).toContain('fraud');
    expect(rolesOn(12).length).toBe(5);
    const r = rng(16);
    const seen = new Set(Array.from({ length: 300 }, () => pickRole(9, 'show', r)));
    expect(seen.size).toBe(5);
  });
});

describe('kindergarten: the school day', () => {
  it('runs through five periods, and the Principal visits during Friday’s show and tell', () => {
    const s = newGame(1000, 600);
    s.wave = 5; // Friday
    const r = rng(17);
    const periods: string[] = [];
    let principal = false;
    for (let t = 0; t < CONFIG.waveLength + 0.5 && s.phase === 'playing'; t += 0.05) {
      step(s, 0.05, r);
      for (const e of s.events) {
        if (e.type === 'period') periods.push(e.period.id);
        if (e.type === 'spawn' && e.hand.role === 'principal') principal = true;
      }
      s.events = [];
      // Keep it alive: slap every thief that gets close.
      for (const hand of s.hands) if (hand.kind === 'thief' && !hand.slapped && hand.progress > 0.6 && hand.stun <= 0) { const at = handPosition(hand); slap(s, at.x, at.y); }
    }
    expect(periods).toEqual(['circle', 'snack', 'recess', 'nap', 'show']);
    expect(principal).toBe(true);
  });

  it('a report card at the end of the day, and an allowance on Fridays', async () => {
    const { reportCard } = await import('./school.ts');
    expect(reportCard({ thieves: 20, stopped: 19, trades: 12, profit: 6, violations: 0, stolen: 1 })).toMatchObject({ defence: 'A', economics: 'A', citizenship: 'A' });
    expect(reportCard({ thieves: 20, stopped: 5, trades: 0, profit: 0, violations: 5, stolen: 15 })).toMatchObject({ defence: 'F', economics: 'F', citizenship: 'F' });
    const s = quiet(newGame(1000, 600));
    s.wave = 5;
    s.waveTime = CONFIG.waveLength;
    const before = s.blocks;
    step(s, 0.05, rng(18));
    expect(s.phase).toBe('break');
    expect(s.report).not.toBeNull();
    expect(s.events.some((e) => e.type === 'allowance')).toBe(true);
    expect(s.blocks).toBeGreaterThan(before);
  });
});

describe('kindergarten: achievements', () => {
  it('unique ids, all filled in, and saves keep only known ones', async () => {
    const { ACHIEVEMENTS, normalizeUnlocked } = await import('./achievements.ts');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.icon && a.name && a.description, a.id).toBeTruthy();
    expect([...normalizeUnlocked(['tgif', 'nope', 7])]).toEqual(['tgif']);
  });

  it('a sale says how much better off Jack is', () => {
    const s = quiet(newGame(1000, 600));
    s.stash = [{ item: 'card', cost: 1 }];
    let hand = spawnHand(s, rng(70), 'trader');
    for (let k = 0; hand.offer!.wants !== 'item' && k < 20; k++) {
      s.hands = [];
      hand = spawnHand(s, rng(71 + k), 'trader');
    }
    reach(s, hand);
    const trade = s.events.find((e) => e.type === 'trade');
    expect(trade && trade.type === 'trade' && trade.profit).toBe(hand.offer!.price - 1);
  });
});
