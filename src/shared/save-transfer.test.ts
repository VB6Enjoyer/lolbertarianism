import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, saveFileName } from './save-transfer.ts';

const stored = JSON.stringify({ v: 1, data: { peanutsEarned: 312, looks: '👓 glasses', name: 'Ludwig' } });

describe('save codes', () => {
  it('round-trip a save exactly, emoji included', () => {
    const code = encodeSave('basic-economics-trainer', stored);
    expect(code.startsWith('LOLB1:basic-economics-trainer:')).toBe(true);
    expect(decodeSave('basic-economics-trainer', code)).toEqual({ ok: true, stored });
  });

  it('ignore spaces and line breaks from copying', () => {
    const code = encodeSave('road-to-liberty', stored);
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 50)} \r\n${code.slice(50)}\n`;
    expect(decodeSave('road-to-liberty', messy)).toEqual({ ok: true, stored });
  });

  it('refuse a save from another game, and say which game it’s for', () => {
    const result = decodeSave('road-to-liberty', encodeSave('libertarian-fight-club', stored));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Libertarian Fight Club');
  });

  it('refuse empty, foreign, cut-off and non-save codes', () => {
    expect(decodeSave('road-to-liberty', '   ').ok).toBe(false);
    expect(decodeSave('road-to-liberty', 'ANCAP1:abcd').ok).toBe(false);
    expect(decodeSave('road-to-liberty', 'hello there').ok).toBe(false);
    const code = encodeSave('road-to-liberty', stored);
    expect(decodeSave('road-to-liberty', code.slice(0, -12)).ok).toBe(false);
    // Valid base64, but not a save inside.
    expect(decodeSave('road-to-liberty', encodeSave('road-to-liberty', '"just text"')).ok).toBe(false);
    expect(decodeSave('road-to-liberty', encodeSave('road-to-liberty', '{"v":1}')).ok).toBe(false);
    expect(decodeSave('road-to-liberty', encodeSave('road-to-liberty', 'not json')).ok).toBe(false);
  });

  it('name downloaded files after the game and the day', () => {
    expect(saveFileName('road-to-liberty', new Date(2026, 10, 8))).toBe('road-to-liberty-save-2026-11-08.txt');
  });
});
