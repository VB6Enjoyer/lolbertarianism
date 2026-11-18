// Late Stages: difficulty levels. Win on a stage and the next one opens; every stage keeps all the
// twists of the ones before it. (It's always one stage later. It's never over.)

export interface Stage {
  n: number;
  name: string;
  /** The twist this stage adds (on top of every earlier one). */
  rule: string;
}

export const STAGES: readonly Stage[] = [
  { n: 1, name: 'Late Stage', rule: 'The run as you know it.' },
  { n: 2, name: 'Later Stage', rule: 'Hostile panels hit 25% harder.' },
  { n: 3, name: 'Regrettable Stage', rule: 'Start every run with a Regret in your deck.' },
  { n: 4, name: 'Bloated Stage', rule: 'Enemies have 15% more Credibility.' },
  { n: 5, name: 'Burnout Stage', rule: 'The green room heals 20% instead of 30%.' },
  { n: 6, name: 'It’s Not Over Stage', rule: 'Bosses get back up once, with 40% of their Credibility.' },
  { n: 7, name: 'Austerity Stage', rule: 'Max Credibility 60 instead of 70.' },
  { n: 8, name: 'Inflationary Stage', rule: 'Bookstore prices are 25% higher.' },
  { n: 9, name: 'Recession Stage', rule: '30% fewer Royalties after fights.' },
  { n: 10, name: 'Terminal Stage', rule: 'Every fight starts with an Inflation in your draw pile.' },
];

export const MAX_STAGE = STAGES.length;
export const stageInfo = (n: number) => STAGES[Math.max(1, Math.min(MAX_STAGE, Math.floor(n))) - 1];
export const clampStage = (n: unknown) => Math.max(1, Math.min(MAX_STAGE, Math.floor(Number(n) || 1)));

/** A run's score goes up 15% for each stage above the first. */
export const stageMultiplier = (stage: number) => 1 + 0.15 * (clampStage(stage) - 1);
