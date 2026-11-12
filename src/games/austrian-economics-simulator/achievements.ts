// Achievements, saved in localStorage. The Tracker reads each frame's events
// and state, and reports what's newly unlocked.

import { GEAR, type GameEvent, type GameState } from './logic.ts';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-cover', icon: '⚙️', name: 'Original Appropriation', description: 'Steal your first manhole cover. Homesteading, basically.' },
  { id: 'lap', icon: '🔄', name: 'Austrian Business Cycle', description: 'Go all the way around: steal, sell, buy, wait for the replacement.' },
  { id: 'laps-5', icon: '♾️', name: 'Perpetual Motion', description: 'Go around the cycle 5 times in one run.' },
  { id: 'peak', icon: '📈', name: 'Sell the Top', description: 'Sell a cover while scrap is worth double or more.' },
  { id: 'stash-5', icon: '🐿️', name: 'Low Time Preference', description: 'Have 5 covers saved in your squat.' },
  { id: 'cantillon', icon: '🏦', name: 'Cantillon Effect', description: 'Sell at Cantillon Scrap for 30% more than the other yard pays.' },
  { id: 'capital', icon: '🏭', name: 'Roundabout Production', description: 'Own all four capital goods in one run.' },
  { id: 'vest', icon: '🦺', name: 'Just Wear a Vest', description: 'Steal a cover right in front of a City Works crew.' },
  { id: 'cop-fall', icon: '🕳️', name: 'Officer Down (the Hole)', description: 'A cop falls into an open manhole.' },
  { id: 'peds-3', icon: '🤕', name: 'Negative Externalities', description: '3 passers-by fall in during one run.' },
  { id: 'both', icon: '💊', name: 'Diversified Portfolio', description: 'Buy both heroin and crack in one run.' },
  { id: 'dea', icon: '🚔', name: 'Supply Shock', description: 'Buy during a DEA raid.' },
  { id: 'bust', icon: '📉', name: 'Malinvestment Liquidated', description: 'Survive a whole bust.' },
  { id: 'survive-5', icon: '⏳', name: 'In the Long Run We Are All Alive', description: 'Last 5 minutes.' },
  { id: 'rich', icon: '💰', name: 'Hard Money', description: 'Have $500 in cash at once.' },
  { id: 'utils-100', icon: '😌', name: 'Marginal Utility', description: 'Get 100 utils in one run.' },
  { id: 'utils-300', icon: '🤤', name: 'Diminishing Returns? Never Heard of Them', description: 'Get 300 utils in one run.' },
  { id: 'arrested', icon: '⛓️', name: 'Victimless Crime', description: 'Get arrested.' },
  { id: 'interest', icon: '🏦', name: 'Interest on Reserve Balances', description: 'Earn $50 in interest in one run.' },
  { id: 'cheap-credit', icon: '💳', name: 'Cheap Credit', description: 'Borrow during a boom.' },
  { id: 'repaid', icon: '🤝', name: 'Sound Finances', description: 'Pay off a called loan before the bust ends.' },
  { id: 'default', icon: '💸', name: 'Too Small to Bail Out', description: 'Default on a loan.' },
  { id: 'gold-5', icon: '🪙', name: 'Gold Bug', description: 'Own 5 ounces of gold.' },
  { id: 'gold-bust', icon: '🥇', name: 'Barbarous Relic', description: 'Sell gold during a bust.' },
  { id: 'brass', icon: '🎺', name: 'Historical Revisionism', description: 'Steal a brass cover.' },
  { id: 'fed-cover', icon: '🏛️', name: "End the Fed('s Manhole)", description: "Steal the Fed's own manhole cover." },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export class Tracker {
  private bought = new Set<string>();

  constructor(readonly unlocked: Set<string>) {}

  startRun(): void {
    this.bought = new Set();
  }

  private unlock(id: string, found: string[]) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    found.push(id);
  }

  /** Call with each batch of events (from update or an action). Returns the ids unlocked just now. */
  update(state: GameState, events: readonly GameEvent[]): string[] {
    const found: string[] = [];
    const add = (id: string) => this.unlock(id, found);
    for (const e of events) {
      switch (e.type) {
        case 'stole':
          add('first-cover');
          if (e.underCrewsNose) add('vest');
          if (e.kind === 'brass') add('brass');
          if (e.kind === 'fed') add('fed-cover');
          break;
        case 'borrowed':
          if (e.phase === 'boom') add('cheap-credit');
          break;
        case 'repaid':
          if (e.cleared && e.called) add('repaid');
          break;
        case 'default':
          add('default');
          break;
        case 'gold-sold':
          if (e.phase === 'bust') add('gold-bust');
          break;
        case 'lap':
          add('lap');
          if (e.laps >= 5) add('laps-5');
          break;
        case 'sold':
          if (e.multiplier >= 2) add('peak');
          if (e.yard === 'yard-near' && e.price >= e.otherPrice * 1.3) add('cantillon');
          break;
        case 'bought':
          this.bought.add(e.drug);
          if (this.bought.size >= 2) add('both');
          if (e.dea) add('dea');
          break;
        case 'fell':
          if (e.who === 'cop') add('cop-fall');
          break;
        case 'over':
          if (e.reason === 'arrested') add('arrested');
          break;
      }
    }
    if (state.stash.length >= 5) add('stash-5');
    if (state.stats.interest >= 50) add('interest');
    if (state.gold >= 5) add('gold-5');
    if (GEAR.every((g) => state.gear[g.id])) add('capital');
    if (state.stats.pedsFell >= 3) add('peds-3');
    if (state.stats.bustsSurvived >= 1) add('bust');
    if (state.time >= 300) add('survive-5');
    if (state.cash >= 500) add('rich');
    if (state.utils >= 100) add('utils-100');
    if (state.utils >= 300) add('utils-300');
    return found;
  }
}

export function normalizeUnlocked(raw: unknown): Set<string> {
  return new Set((Array.isArray(raw) ? raw : []).filter((id): id is string => typeof id === 'string' && !!achievementById(id)));
}
