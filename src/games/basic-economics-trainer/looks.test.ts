import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements.ts';
import { anyaSvg } from './anya.ts';
import { LIFELINES } from './bank.ts';
import { emptyOutfit, LOOKS, lockedLabel, lockedShort, lookById, lookUnlocked, outfitFrom, SLOTS, wearMarkup, wornLooks } from './looks.ts';

describe('Anya’s looks', () => {
  it('has unique ids and labels, each with an emoji and something to say', () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(new Set(LOOKS.map((l) => l.label)).size).toBe(LOOKS.length);
    for (const l of LOOKS) {
      expect(l.label).toMatch(/^\S+ \S/);
      expect(l.line.length).toBeGreaterThan(10);
    }
  });

  it('fills every slot, and draws hats and glasses but not colours', () => {
    for (const { slot } of SLOTS) expect(LOOKS.some((l) => l.slot === slot)).toBe(true);
    for (const l of LOOKS) expect(!!l.art).toBe(l.slot === 'head' || l.slot === 'face');
  });

  it('unlocks with real achievements or a peanut score', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const l of LOOKS) {
      if ('peanuts' in l.unlock) expect(l.unlock.peanuts).toBeGreaterThan(0);
      else expect(ids.has(l.unlock.achievement), l.id).toBe(true);
    }
    const glasses = lookById('glasses')!;
    expect(lookUnlocked(glasses, 49, new Set())).toBe(false);
    expect(lookUnlocked(glasses, 50, new Set())).toBe(true);
    const cap = lookById('mortarboard')!;
    expect(lookUnlocked(cap, 5000, new Set())).toBe(false);
    expect(lookUnlocked(cap, 0, new Set(['exam']))).toBe(true);
  });

  it('says what a locked look takes, unless it’s a secret', () => {
    expect(lockedLabel(lookById('glasses')!, 20)).toBe('🔒 Reading glasses: 30 more 🥜');
    expect(lockedLabel(lookById('mortarboard')!, 0)).toBe('🔒 Graduation cap: Pass a final exam');
    expect(lockedLabel(lookById('ushanka')!, 0)).toBe('🔒 A secret look');
    // Phones get just what it takes.
    expect(lockedShort(lookById('glasses')!, 20)).toBe('🔒 30 more 🥜');
    expect(lockedShort(lookById('mortarboard')!, 0)).toBe('🔒 Pass a final exam');
    expect(lockedShort(lookById('ushanka')!, 0)).toBe('🔒 Secret');
  });

  it('reads saved outfits, and the two switches older saves had', () => {
    expect(outfitFrom(undefined)).toEqual(emptyOutfit());
    expect(outfitFrom(null, { pink: true, green: false })).toEqual({ ...emptyOutfit(), hair: 'pink-hair' });
    expect(outfitFrom(undefined, { pink: true, green: true })).toEqual({ ...emptyOutfit(), hair: 'pink-hair', eyes: 'green-eyes' });
    // Unknown looks, and looks in the wrong slot, are dropped.
    expect(outfitFrom({ head: 'crown', face: 'crown', hair: 'nope', eyes: 3 })).toEqual({ ...emptyOutfit(), head: 'crown' });
  });

  it('wears only looks you have, with the hat drawn over the glasses', () => {
    const outfit = { ...emptyOutfit(), head: 'top-hat', face: 'glasses', hair: 'gold-hair' };
    const all = wornLooks(outfit, () => true);
    expect(all.map((l) => l.id).sort()).toEqual(['glasses', 'gold-hair', 'top-hat']);
    expect(wornLooks(outfit, (l) => l.id !== 'top-hat').map((l) => l.id)).not.toContain('top-hat');
    const svg = wearMarkup(all);
    expect(svg.indexOf('rotate(-8')).toBeGreaterThan(svg.indexOf('<circle cx="158"'));
    expect(wearMarkup([])).toBe('');
  });

  it('has the layer and gradients the looks need on Anya', () => {
    const svg = anyaSvg();
    for (const id of ['anya-wear', 'anya-iris-green', 'anya-iris-gold', 'anya-hair-ancap']) expect(svg).toContain(`id="${id}"`);
    expect(svg).toContain('class="anya-clips"');
  });
});

describe('Lifelines', () => {
  it('are free, a few per quiz', () => {
    for (const n of Object.values(LIFELINES)) expect(n).toBeGreaterThan(0);
  });
});
