// Rothbard on speakerphone: what he says when things happen. Add lines freely.

export type Cue =
  | 'start'
  | 'marx'
  | 'combo'
  | 'gold'
  | 'fuel'
  | 'low-fuel'
  | 'out-of-gas'
  | 'roadblock'
  | 'traffic'
  | 'spikes'
  | 'cruiser'
  | 'spikes-ahead'
  | 'cruiser-ahead'
  | 'cops-close'
  | 'border'
  | 'nightfall'
  | 'rain'
  | 'idle'
  | 'donuts'
  | 'killdozer'
  | 'smoke'
  | 'smash'
  | 'engels'
  | 'lenin'
  | 'stalin'
  | 'mao'
  | 'che'
  | 'repair';

export const LINES: Record<Cue, readonly string[]> = {
  start: [
    'Floor it! The State is a gang of thieves writ large.',
    "You're on speakerphone. Drive like the Fed is behind you. Because it is.",
    'Remember: the roads would be better if we owned them.',
  ],
  marx: [
    'Ha! Labor theory of value: refuted.',
    "That's one less surplus-value theorist.",
    'Means of production? Seized. By your bumper.',
    'Karl never did understand price signals. Or brake lights.',
    'Dialectics meets the bumper!',
  ],
  combo: [
    'A combo! Hayek would call it spontaneous order.',
    "Keep going! It's a business cycle of beards!",
    'This is what praxeology looks like!',
  ],
  gold: ['Sound money! Keep it away from the Fed.', 'Gold: the only honest money.', 'Into the vault it goes.'],
  fuel: ['Gas! Voluntarily exchanged, of course.', 'Full tank. Untaxed, I hope?'],
  'low-fuel': ['Fuel is low! Grab a jerry can.', "You're running on fumes. And on principle."],
  'out-of-gas': ['Out of gas?! Find a can, fast!', 'Empty! The State wins by attrition, again.'],
  roadblock: ['A checkpoint! Papers, please. Ugh.', 'Never comply with a roadblock. Steer around it!'],
  traffic: ['Watch the road! Not every driver is an entrepreneur.', 'Slowpoke! Probably a public-sector employee.'],
  spikes: ["Spike strips! That's an aggression against your tires.", 'Tires blown. Bill the State.'],
  cruiser: ['They rammed us! That is a violation of the NAP!', 'Police brutality! Against a sedan!'],
  'spikes-ahead': ['Spikes ahead! Find the open lane!', 'Spike strip coming up! Two lanes blocked!'],
  'cruiser-ahead': ["Cruiser ahead! He'll try to box you in!", 'A cop up front! Swerve away from him!'],
  'cops-close': ["They're right behind us! Faster!", 'I can hear the sirens through the phone!', "Don't let them catch you! I'm not posting your bail!"],
  border: [
    'A free border! Exit beats voice every time.',
    'Crossed! Secession: the ultimate check on power.',
    "New jurisdiction, same principles. Keep driving!",
  ],
  nightfall: ['Night falls. The State never sleeps, so neither do we.', 'Lights on! Darkness is no excuse for statism.'],
  rain: ['Rain! The roads are slick. Public roads, naturally.', 'Careful, it\'s wet out. Ease into the curves.'],
  donuts: ['Donuts! The oldest bribe in the book. Works every time.', 'They stopped for donuts. Public servants, everyone.'],
  killdozer: ['The Killdozer! Property rights, enforced.', 'Plow through! Every checkpoint is a broken window now.'],
  smoke: ['Smoke screen! Exit, stage left.', "They can't arrest what they can't see!"],
  engels: ['Engels! The factory owner who bankrolled Marx. Irony, flattened.', 'Engels down! His capital couldn\'t save him.'],
  lenin: ["Lenin! That one's for the kulaks.", 'All power to the bumper!'],
  stalin: ['Stalin! One flattening is a tragedy; this one is a statistic.', 'Uncle Joe, purged!'],
  mao: ['Mao! The Great Leap Backward, under our tires.', "That's one cultural revolution he didn't see coming."],
  che: ['Che! Finally on a T-shirt worth wearing: our tire tread.', 'Hasta la victoria siempre. Ours.'],
  repair: ['Good as new! A private mechanic, naturally.', "Böhm-Bawerk's wrench: capital goods at work!"],
  smash: ['Creative destruction!', "That's what I call a hostile takeover.", 'Bill the State for the damages.'],
  idle: [
    "What's on the radio? Turn it up.",
    'Did I ever tell you about the Circle Bastiat?',
    'The State is the organization of the political means.',
    'Ludwig would be proud of this driving.',
    "Remind me: who will build the roads? Apparently, you're driving on them.",
    'Taxation is theft. Speeding is just entrepreneurship.',
  ],
};

/** Warnings and emergencies interrupt; small talk waits its turn. */
export const URGENT: ReadonlySet<Cue> = new Set(['spikes-ahead', 'cruiser-ahead', 'cops-close', 'out-of-gas', 'border']);

/** Picks a line for a cue, avoiding the one used last time for it. `roll` in [0, 1). */
export function pickLine(cue: Cue, roll: number, last?: string): string {
  const lines = LINES[cue];
  const pool = lines.length > 1 && last ? lines.filter((l) => l !== last) : lines;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}
