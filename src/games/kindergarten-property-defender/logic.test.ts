import { describe, expect, it } from 'vitest';
import { CONFIG, handPosition, multiplier, newGame, nextWave, slap, spawnHand, step, traderShare, type GameState, type Hand } from './logic.ts';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Moves a hand all the way to the pile. */
function reach(s: GameState, hand: Hand, r = rng(1)) {
  for (let i = 0; i < 400 && hand.state === 'reaching' && s.phase === 'playing'; i++) step(s, 0.02, r);
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
