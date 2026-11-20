import { describe, expect, it } from 'vitest';
import { act, addBot, backToLobby, botMoves, canStart, join, newRoom, privateView, publicView, removeMember, type Room, roomCode, seatOf, start, validCode, waitingOn } from './online.ts';

const lobby = (n: number): Room => {
  const r = newRoom('ABCDE', 'host', 'Hosty');
  for (let i = 1; i < n; i++) join(r, `p${i}`, `Player ${i}`);
  return r;
};
const ids = (r: Room) => r.members.map((m) => m.id);
/** A tiny deterministic random source. */
const seq = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('online rooms: the lobby', () => {
  it('room codes are five easy-to-read characters', () => {
    for (let i = 0; i < 50; i++) expect(validCode(roomCode())).toBe(true);
    expect(validCode('ABC1O')).toBe(false); // no 1, no O: too easy to misread
  });

  it('people join (and keep their seat on a refresh), up to 8; bots fill seats; the host starts at 4', () => {
    const r = lobby(3);
    expect(canStart(r)).toBe(false);
    expect(join(r, 'p1', 'Renamed')).toBe(true);
    expect(r.members[1].name).toBe('Renamed');
    expect(r.members).toHaveLength(3);
    addBot(r);
    expect(canStart(r)).toBe(true);
    for (let i = 0; i < 6; i++) addBot(r);
    expect(r.members).toHaveLength(8);
    expect(join(r, 'late', 'Late')).toBe(false);
    expect(removeMember(r, 'host')).toBe(false);
    expect(removeMember(r, r.members[7].id)).toBe(true);
    expect(start(r, 42)).toBe(true);
    expect(join(r, 'late', 'Late')).toBe(false); // too late to sit down
    expect(join(r, 'p1', 'Again')).toBe(true); // but a refresh finds your seat
  });

  it('a host can run the table without playing (the big-screen way)', () => {
    const r = newRoom('ABCDE', 'screen', null);
    expect(r.members).toHaveLength(0);
    for (let i = 0; i < 4; i++) join(r, `p${i}`, `P${i}`);
    expect(start(r, 3)).toBe(true);
    expect(privateView(r, 'screen').seat).toBeNull();
    expect(privateView(r, 'screen').chairing).toBe(true);
  });
});

describe('online rooms: playing', () => {
  it('everyone acts at once, in any order, and the engine gets it in seat order', () => {
    const r = lobby(5);
    start(r, 7);
    const g = r.game!;
    // Role cards, seen out of order.
    for (const id of [...ids(r)].reverse()) expect(act(r, id, { type: 'seen' })).toBe(true);
    expect(g.phase).toBe('briefing');
    // Only the Chair (or the host) deals.
    const chairId = r.members[g.chair].id;
    const someoneElse = ids(r).find((id) => id !== chairId && id !== 'host')!;
    expect(act(r, someoneElse, { type: 'deal' })).toBe(false);
    expect(act(r, chairId, { type: 'deal' })).toBe(true);
    expect(g.phase).toBe('propose');
    // The Chair doesn't propose: they pick from everyone else's.
    expect(privateView(r, chairId).hand).toBeNull();
    expect(act(r, chairId, { type: 'propose', policy: 'anything' })).toBe(false);
    // Proposals arrive back to front; nothing is tabled until everyone's in.
    const order = [...ids(r)].reverse().filter((id) => id !== chairId);
    for (const [k, id] of order.entries()) {
      const seat = seatOf(r, id);
      expect(act(r, id, { type: 'propose', policy: 'not-in-hand' })).toBe(false);
      expect(act(r, id, { type: 'propose', policy: g.hands[seat][0] })).toBe(true);
      expect(act(r, id, { type: 'propose', policy: g.hands[seat][1] })).toBe(false); // once
      if (k < order.length - 1) expect(publicView(r).proposals).toEqual([]);
    }
    expect(g.phase).toBe('table');
    expect(publicView(r).proposals.map((p) => p.player)).toEqual([0, 1, 2, 3, 4].filter((i) => i !== g.chair));
    expect(act(r, chairId, { type: 'enact', index: 0 })).toBe(true);
    expect(act(r, chairId, { type: 'callVote' })).toBe(true);
    // Votes: you can't vote for yourself; the result waits for everyone.
    expect(act(r, 'p1', { type: 'vote', target: 1 })).toBe(false);
    for (const id of ids(r)) act(r, id, { type: 'vote', target: seatOf(r, id) === 2 ? 3 : 2 });
    expect(g.phase === 'voted' || g.phase === 'over').toBe(true);
    expect(g.players[2].fired).toBe(true);
    expect(publicView(r).players[2].impostor).toBe(g.players[2].impostor); // revealed once fired
  });

  it('nobody sees anyone else’s secrets: the public view hides roles, hands and votes; private views only your own', () => {
    const r = lobby(6);
    start(r, 11);
    const pub = JSON.stringify(publicView(r));
    expect(pub).not.toContain('"impostor":true');
    expect(pub).not.toContain('"impostor":false');
    for (const id of ids(r)) act(r, id, { type: 'seen' });
    act(r, r.members[r.game!.chair].id, { type: 'deal' });
    const g = r.game!;
    const seat = g.chair === 1 ? 2 : 1;
    const p1 = privateView(r, `p${seat}`);
    expect(p1.hand).toEqual(g.hands[seat]);
    expect(JSON.stringify(publicView(r))).not.toContain(g.hands[seat][0]);
    // Only impostors learn who their friends are.
    for (const id of ids(r)) {
      const v = privateView(r, id);
      if (!v.impostor) expect(v.fellows).toEqual([]);
      else expect(v.fellows.length).toBe(g.players.filter((p) => p.impostor).length - 1);
    }
    expect(waitingOn(r)).toHaveLength(5); // everyone but the Chair
  });

  it('bots fill the empty seats and can play whole games with you', () => {
    let finished = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = newRoom('ABCDE', 'host', 'Me');
      for (let i = 0; i < 4; i++) addBot(r);
      start(r, seed);
      const rand = seq(seed);
      for (let guard = 0; guard < 400 && r.game!.phase !== 'over'; guard++) {
        const moves = botMoves(r, rand);
        // The human: sees their role, proposes their first card, votes for nobody, chairs like a bot.
        const me = privateView(r, 'host');
        const g = r.game!;
        if (g.phase === 'roles' && !me.seenRole) act(r, 'host', { type: 'seen' });
        else if (me.hand) act(r, 'host', { type: 'propose', policy: me.hand[0] });
        else if (me.canVote) act(r, 'host', { type: 'vote', target: -1 });
        else if (g.chair === 0 && g.phase === 'briefing') act(r, 'host', { type: 'deal' });
        else if (g.chair === 0 && g.phase === 'table') act(r, 'host', { type: 'enact', index: 0 });
        else if (g.chair === 0 && (g.phase === 'result' || g.phase === 'voted')) act(r, 'host', { type: 'next' });
        for (const m of moves) act(r, m.id, m.intent);
      }
      if (r.game!.phase === 'over') finished++;
      backToLobby(r);
      expect(r.game).toBeNull();
      expect(r.members).toHaveLength(5);
    }
    expect(finished).toBe(30);
  });

  it('survives being saved and loaded mid-game (a host refresh)', () => {
    const r = lobby(4);
    start(r, 5);
    for (const id of ids(r)) act(r, id, { type: 'seen' });
    const copy: Room = JSON.parse(JSON.stringify(r));
    act(r, r.members[r.game!.chair].id, { type: 'deal' });
    act(copy, copy.members[copy.game!.chair].id, { type: 'deal' });
    expect(JSON.stringify(copy)).toBe(JSON.stringify(r));
  });
});
