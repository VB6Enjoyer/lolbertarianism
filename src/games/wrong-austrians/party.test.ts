import { describe, expect, it } from 'vitest';
import { findPolicy } from './council.ts';
import {
  activePlayers, beginProposals, callVote, castVote, chairEnacts, fellowImpostors, impostorsFor, loyalWins, MAX_PLAYERS, MIN_PLAYERS, newParty, nextPartyQuarter,
  type PartyGame, partyCrisis, propose, roleSeen,
} from './party.ts';
import { makeRng, next } from './rng.ts';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

/** Simulated people: the loyal go on the bills; the impostors push bad policy and dodge. */
function play(g: PartyGame, rng = makeRng(g.seed ^ 77), voting = true) {
  const sus: number[] = g.players.map(() => 0);
  const kind = (id: string) => findPolicy(id)!.kind;
  for (let guard = 0; guard < 400 && g.phase !== 'over'; guard++) {
    switch (g.phase) {
      case 'roles': roleSeen(g); break;
      case 'briefing':
        for (const n of g.news) if (n.proposer !== undefined) sus[n.proposer] += n.good ? -1 : 2;
        beginProposals(g); break;
      case 'propose': {
        const me = g.players[g.turn];
        const hand = g.hands[g.turn];
        const good = hand.find((id) => kind(id) === 'sound');
        const bad = hand.find((id) => kind(id) !== 'sound');
        propose(g, me.impostor ? (bad && next(rng) < 0.8 ? bad : hand[0]) : good ?? hand[0]);
        break;
      }
      case 'table': {
        const chair = g.players[g.chair];
        let pick: number;
        if (chair.impostor) {
          const bad = g.proposals.findIndex((p) => kind(p.policy) !== 'sound');
          pick = bad >= 0 && next(rng) < 0.7 ? bad : 0;
        } else {
          // Trust whoever's least suspicious (and themselves).
          const own = g.proposals.findIndex((p) => p.player === g.chair && kind(p.policy) === 'sound');
          const ranked = g.proposals.map((p, i) => ({ i, s: sus[p.player] + next(rng) * 1.5 })).sort((a, b) => a.s - b.s);
          pick = own >= 0 ? own : ranked[0].i;
        }
        chairEnacts(g, pick);
        break;
      }
      case 'result':
        if (voting && Math.max(...activePlayers(g).map(({ i }) => sus[i])) >= 3) callVote(g);
        else nextPartyQuarter(g);
        break;
      case 'vote': {
        const me = g.players[g.turn];
        const others = activePlayers(g).filter(({ i }) => i !== g.turn);
        const top = [...others].sort((a, b) => sus[b.i] - sus[a.i])[0];
        if (me.impostor) {
          const loyal = others.filter(({ p }) => !p.impostor).sort((a, b) => sus[b.i] - sus[a.i])[0];
          castVote(g, loyal ? loyal.i : -1);
        } else castVote(g, top && sus[top.i] >= 3 ? top.i : -1);
        break;
      }
      case 'voted': nextPartyQuarter(g); break;
    }
  }
  return g;
}


describe('party mode', () => {
  it('deals the right number of impostors, who know each other', () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const g = newParty(n, names(n));
      const imps = g.players.map((p, i) => (p.impostor ? i : -1)).filter((i) => i >= 0);
      expect(imps).toHaveLength(impostorsFor(n));
      for (const i of imps) expect(fellowImpostors(g, i).sort()).toEqual(imps.filter((k) => k !== i).sort());
      const loyal = g.players.findIndex((p) => !p.impostor);
      expect(fellowImpostors(g, loyal)).toEqual([]);
    }
    expect(() => newParty(1, names(3))).toThrow();
    expect(() => newParty(1, names(9))).toThrow();
  });

  it('passes the phone for roles, then deals two different policies of the crisis to everyone', () => {
    const g = newParty(4, names(5));
    for (let i = 0; i < 5; i++) {
      expect(g.phase).toBe('roles');
      expect(g.turn).toBe(i);
      roleSeen(g);
    }
    expect(g.phase).toBe('briefing');
    const ids = partyCrisis(g).policies.map((p) => p.id);
    for (let i = 0; i < 5; i++) {
      expect(g.hands[i]).toHaveLength(2);
      expect(new Set(g.hands[i]).size).toBe(2);
      for (const id of g.hands[i]) expect(ids).toContain(id);
    }
  });

  it('takes one proposal from each player, from their own hand, then the Chair enacts one', () => {
    const g = newParty(5, names(4));
    for (let i = 0; i < 4; i++) roleSeen(g);
    beginProposals(g);
    expect(propose(g, 'not-a-card')).toBe(false);
    for (let i = 0; i < 4; i++) {
      expect(g.turn).toBe(i);
      expect(propose(g, g.hands[i][1])).toBe(true);
    }
    expect(g.phase).toBe('table');
    expect(g.proposals.map((p) => p.player)).toEqual([0, 1, 2, 3]);
    expect(chairEnacts(g, 2)).toBe(true);
    expect(g.pending).toEqual([expect.objectContaining({ policy: g.proposals[2].policy, proposer: 2 })]);
  });

  it('fires on a strict majority, never on a tie, and you can’t vote for yourself', () => {
    const setup = () => {
      const g = newParty(6, names(5));
      for (let i = 0; i < 5; i++) roleSeen(g);
      beginProposals(g);
      for (let i = 0; i < 5; i++) propose(g, g.hands[i][0]);
      chairEnacts(g, 0);
      callVote(g);
      return g;
    };
    const g = setup();
    expect(castVote(g, 0)).toBe(false);
    for (const target of [3, 3, 3, -1, 0]) castVote(g, target);
    expect(g.lastVote?.fired).toBe(3);
    expect(g.players[3].fired).toBe(true);
    const tie = setup();
    for (const target of [1, 0, 1, 0, -1]) castVote(tie, target);
    expect(tie.lastVote?.fired).toBeNull();
    expect(tie.players.every((p) => !p.fired)).toBe(true);
  });

  it('names the proposer when the bill lands, and rotates the Chair', () => {
    const g = newParty(7, names(6));
    for (let i = 0; i < 6; i++) roleSeen(g);
    const chair = g.chair;
    beginProposals(g);
    for (let i = 0; i < 6; i++) propose(g, g.hands[i][0]);
    chairEnacts(g, 1);
    const pol = findPolicy(g.proposals[1].policy)!;
    for (let q = 0; q < pol.later.in; q++) {
      nextPartyQuarter(g);
      if (g.phase === ('over' as string)) return;
      if (q < pol.later.in - 1) {
        beginProposals(g);
        for (const { i } of activePlayers(g)) propose(g, g.hands[i][0]);
        chairEnacts(g, 0);
      }
    }
    expect(g.news.find((n) => n.policy === pol.id)?.proposer).toBe(1);
    expect(g.chair).not.toBe(chair);
  });

  it('the loyal side wins by firing every impostor; the impostors win on parity', () => {
    const g = newParty(8, names(4));
    for (let i = 0; i < 4; i++) roleSeen(g);
    beginProposals(g);
    for (let i = 0; i < 4; i++) propose(g, g.hands[i][0]);
    chairEnacts(g, 0);
    callVote(g);
    const imp = g.players.findIndex((p) => p.impostor);
    for (const { i } of activePlayers(g)) castVote(g, i === imp ? (imp + 1) % 4 : imp);
    expect(g.ending).toBe('purged');
    expect(loyalWins(g)).toBe(true);

    const h = newParty(9, names(4));
    for (let i = 0; i < 4; i++) roleSeen(h);
    beginProposals(h);
    for (let i = 0; i < 4; i++) propose(h, h.hands[i][0]);
    chairEnacts(h, 0);
    callVote(h);
    const loyal = h.players.findIndex((p) => !p.impostor);
    for (const { i } of activePlayers(h)) castVote(h, i === loyal ? (loyal + 1) % 4 : loyal);
    // 4 players, 1 impostor: firing one loyal leaves 1 against 2, so not yet parity.
    expect(h.ending).toBeNull();
  });

  it('saves and loads mid-round', () => {
    const g = newParty(10, names(5));
    for (let i = 0; i < 5; i++) roleSeen(g);
    beginProposals(g);
    propose(g, g.hands[0][0]);
    const copy: PartyGame = JSON.parse(JSON.stringify(g));
    for (const x of [g, copy]) for (let i = 1; i < 5; i++) propose(x, x.hands[i][0]);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(g));
  });

  it('is roughly even at every table size, with simulated people', () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      let loyal = 0;
      for (let s = 1; s <= 400; s++) if (loyalWins(play(newParty(s * 7919, names(n))))) loyal++;
      expect(loyal / 400, `${n} players`).toBeGreaterThan(0.4);
      expect(loyal / 400, `${n} players`).toBeLessThan(0.72);
    }
  });
});
