import { describe, expect, it } from 'vitest';
import { FEATS, featDone, type Lifetime, unlockedCharacters, unlockedMaps } from './feats.ts';

const fresh = (): Lifetime => ({ runs: 0, kills: 0, banks: 0, marx: 0, best: {} });

describe('feats', () => {
  it('only Ancapball to begin with', () => {
    expect(unlockedCharacters(fresh())).toEqual(['ancap']);
  });

  it('each libertarian has a feat, with progress', () => {
    const r = fresh();
    r.best.ancap = 200;
    expect(FEATS.minarchist!.progress(r)).toEqual([200, 300]);
    r.best.ancap = 301;
    expect(featDone('minarchist', r)).toBe(true);
    r.kills = 2499;
    expect(featDone('agorist', r)).toBe(false);
    r.kills = 2500;
    expect(featDone('agorist', r)).toBe(true);
    expect(featDone('austrian', r)).toBe(false);
    r.banks = 1;
    expect(unlockedCharacters(r)).toEqual(['ancap', 'minarchist', 'agorist', 'austrian']);
  });

  it('keeps anyone already played or already unlocked (older saves)', () => {
    const r = fresh();
    r.best.austrian = 40;
    expect(unlockedCharacters(r)).toEqual(['ancap', 'austrian']);
    expect(unlockedCharacters(fresh(), ['agorist'])).toEqual(['ancap', 'agorist']);
  });

  it('the maps unlock too: Vienna for 7:30, the vault for bringing down Marx', () => {
    const r = fresh();
    expect(unlockedMaps(r)).toEqual(['streets']);
    r.best.ancap = 450;
    expect(unlockedMaps(r)).toEqual(['streets', 'vienna']);
    r.marx = 1;
    expect(unlockedMaps(r)).toEqual(['streets', 'vienna', 'vault']);
  });
});
