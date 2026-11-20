// Online party mode, the screens: the menu (host a room, or join one), the lobby, and the table.
// Every device draws the same public table plus its own private panel (its role, its hand, its
// ballot). The host's device also runs the room (net.ts, online.ts). The drawing helpers come from
// main.ts, so this looks like the rest of the game.

import type { BallLook } from './ball.ts';
import { crisisFor, type Mode, policyOf, QUARTERS } from './council.ts';
import type { Effect } from './crises.ts';
import { MAX_PLAYERS, MIN_PLAYERS, TABLES } from './party.ts';
// The network code (and the Realtime library) only loads when someone actually goes online.
import type { HostSave, OnlineHost, OnlinePlayer, PlayerSave } from './net.ts';
const net = () => import('./net.ts');
import { addBot, backToLobby, canStart, type Intent, newRoom, type PrivateView, type PublicView, removeMember, roomCode, start, validCode } from './online.ts';
import { sideOf } from './sides.ts';

export interface Kit {
  h: <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, html?: string) => HTMLElementTagNameMap[K];
  t: <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string) => HTMLElementTagNameMap[K];
  button: (label: string, className: string, onClick: () => void, disabled?: boolean) => HTMLButtonElement;
  ball: (look: BallLook, className?: string) => HTMLElement;
  effectChips: (e: Effect) => HTMLElement;
  play: (name: 'click' | 'enact' | 'caught' | 'oops' | 'bill' | 'win' | 'lose') => void;
  openOverlay: (title: string, fill: (box: HTMLElement) => void, closable?: boolean) => void;
  closeOverlay: () => void;
  quarterLabel: (q: number) => string;
  render: () => void;
  /** Leave online play (back to the party setup screen). */
  leave: () => void;
  screen: HTMLElement;
  hud: HTMLElement;
}

// ---------------------------------------------------------------------------
// State: which screen, and the live connection (host or player)
// ---------------------------------------------------------------------------

const STORE = { host: 'wrong-austrians:online-host', player: 'wrong-austrians:online-player', name: 'wrong-austrians:online-name' };
const load = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const keep = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: the session just won't survive a refresh
  }
};

let host: OnlineHost | null = null;
let player: OnlinePlayer | null = null;
let myName = load<string>(STORE.name) ?? '';
let joinCode = '';
let joinPin: string | null = null;
let hostPlays = true;
let hostMode: Mode = 'ancap';
let lastPhase = '';
/** The host chose to act for an absent Chair (this phase only). */
let override = '';
let kit: Kit;

/** The side being played online (for the meters and flags). */
export function onlineMode(): Mode | null {
  return host?.room.mode ?? player?.view?.mode ?? null;
}

/** An invite link opens straight on the join screen: #join=CODE (or CODE.fingerprint). */
export function openFromHash(): boolean {
  const m = /^#join=([A-Z0-9]{5})(?:\.([A-Za-z0-9]{10}))?$/.exec(location.hash);
  if (!m) return false;
  joinCode = m[1];
  joinPin = m[2] ?? null;
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

const refresh = () => kit?.render();

/** How long a session counts as "still going" for a refreshed page to drop straight back in. */
const RESUME_WITHIN = 3 * 60 * 60 * 1000;

/**
 * A page reload in the middle of a game (a phone locking, the host's tab refreshing): reconnect to
 * the room it was in, if that was recent. Returns whether it did.
 */
export function resumeRecent(): boolean {
  const h = load<HostSave & { at?: number }>(STORE.host);
  if (h && h.at && Date.now() - h.at < RESUME_WITHIN) {
    connectHost(h);
    return true;
  }
  const p = load<PlayerSave & { at?: number }>(STORE.player);
  if (p && p.at && Date.now() - p.at < RESUME_WITHIN) {
    connectPlayer(p);
    return true;
  }
  return false;
}

async function createRoom() {
  const { makeKeys, newId } = await net();
  const { saved } = await makeKeys();
  const hostId = newId();
  const data: HostSave = { room: newRoom(roomCode(), hostId, hostPlays ? myName || 'Host' : null, hostMode), keys: saved, peers: {} };
  keep(STORE.host, data);
  connectHost(data);
}

function connectHost(data: HostSave) {
  player?.close();
  player = null;
  host?.close();
  host = null;
  connecting = true;
  void net().then(({ OnlineHost }) => {
    host = new OnlineHost(data, refresh, (d) => keep(STORE.host, { ...d, at: Date.now() }));
    void host.start();
    connecting = false;
    refresh();
  });
}

async function joinRoom(code: string) {
  const { makeKeys, newId } = await net();
  const saved = load<PlayerSave>(STORE.player);
  const data: PlayerSave =
    saved && saved.code === code ? { ...saved, name: myName || saved.name, pin: joinPin ?? saved.pin } : { code, id: newId(), name: myName || 'Someone', keys: (await makeKeys()).saved, pin: joinPin };
  keep(STORE.player, { ...data, at: Date.now() });
  connectPlayer(data);
}

function connectPlayer(data: PlayerSave) {
  host?.close();
  host = null;
  player?.close();
  player = null;
  connecting = true;
  void net().then(({ OnlinePlayer }) => {
    player = new OnlinePlayer(data, refresh, (d) => keep(STORE.player, { ...d, at: Date.now() }));
    void player.start();
    connecting = false;
    refresh();
  });
}

/** Loading the network code: show "connecting" rather than the menu for that moment. */
let connecting = false;

function closeAll(forget: boolean) {
  host?.close();
  player?.close();
  if (forget) {
    if (host) keep(STORE.host, null);
    if (player) keep(STORE.player, null);
  }
  host = null;
  player = null;
  lastPhase = '';
}

const send = (intent: Intent) => {
  kit.play('click');
  if (host) void host.act(intent);
  else void player?.act(intent);
};

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

export function onlineHud(k: Kit) {
  const v = host?.view ?? player?.view;
  const code = host?.room.code ?? player?.data.code;
  k.hud.append(k.t('span', 'hud-q', code ? `🌐 ${code}${v?.started && v.phase !== 'over' ? ` · ${k.quarterLabel(v.quarter)}` : ''}` : '🌐 Online party'));
  if (v?.started) {
    const sd = sideOf(v.mode);
    for (const [icon, label, val] of [[sd.meters.p[0], sd.meters.p[1], v.prosperity], [sd.meters.l[0], sd.meters.l[1], v.liberty]] as const) {
      const m = k.h('span', `meter${val <= 20 ? ' low' : ''}`, `<span>${icon}</span><b>${val}</b>`);
      m.title = label;
      k.hud.append(m);
    }
  }
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function renderOnline(k: Kit) {
  kit = k;
  const s = k.h('section', 'panel party online');
  if (host) hostScreen(s);
  else if (player) playerScreen(s);
  else if (connecting) s.append(k.t('p', 'pitch', 'Connecting…'));
  else menu(s);
  k.screen.append(s);
}

function nameInput(): HTMLInputElement {
  const { h } = kit;
  const input = h('input', 'online-name');
  input.type = 'text';
  input.maxLength = 16;
  input.placeholder = 'Your name';
  input.value = myName;
  input.setAttribute('aria-label', 'Your name');
  input.addEventListener('input', () => {
    myName = input.value.trim();
    keep(STORE.name, myName);
  });
  return input;
}

function menu(s: HTMLElement) {
  const { h, t, button } = kit;
  s.append(t('h2', 'screen-title', '🌐 Play online'));
  s.append(
    t(
      'p',
      'pitch',
      'For Discord (or anywhere): one person hosts, everyone else joins on their own phone or computer with the room code. Talk it out on voice. Each screen only ever shows its own player’s role, hand and vote.',
    ),
  );
  s.append(nameInput());
  const resumeHost = load<HostSave>(STORE.host);
  const resumePlayer = load<PlayerSave>(STORE.player);
  if (resumeHost || resumePlayer) {
    const back = h('div', 'menu');
    if (resumeHost) back.append(button(`↩ Back to your room <small>${resumeHost.room.code} (hosting)</small>`, 'big', () => connectHost(resumeHost)));
    if (resumePlayer) back.append(button(`↩ Back to room <small>${resumePlayer.code}</small>`, 'big', () => connectPlayer(resumePlayer)));
    s.append(back);
  }

  const hostBox = h('div', 'online-box');
  hostBox.append(t('h3', 'section', '🎙️ Host a room'));
  const sides = h('div', 'party-count');
  for (const [mode, label] of [['ancap', '🦅 Ancapball'], ['mirror', '🪞 Austria']] as [Mode, string][]) {
    const b = button(label, `mode-tab${hostMode === mode ? ' picked' : ''}`, () => {
      hostMode = mode;
      refresh();
    });
    b.setAttribute('aria-pressed', String(hostMode === mode));
    sides.append(b);
  }
  const plays = h('label', 'online-check');
  const box = h('input');
  box.type = 'checkbox';
  box.checked = hostPlays;
  box.addEventListener('change', () => (hostPlays = box.checked));
  plays.append(box, t('span', '', ' I’m playing too (untick to run a shared screen for streaming)'));
  hostBox.append(sides, plays, button('Create a room', 'big', () => void createRoom()));

  const joinBox = h('div', 'online-box');
  joinBox.append(t('h3', 'section', '🚪 Join a room'));
  const code = h('input', 'online-code');
  code.type = 'text';
  code.maxLength = 5;
  code.placeholder = 'CODE';
  code.value = joinCode;
  code.autocapitalize = 'characters';
  code.setAttribute('aria-label', 'Room code');
  code.addEventListener('input', () => {
    code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    joinCode = code.value;
    if (joinPin && joinCode.length < 5) joinPin = null;
  });
  joinBox.append(code, button('Join', 'big', () => (validCode(joinCode) ? void joinRoom(joinCode) : code.focus())));
  if (joinPin) joinBox.append(t('p', 'muted', '🔗 From an invite link: the host’s identity will be checked.'));
  s.append(h('div', 'online-boxes'), button('← Back to party mode', 'big secondary', kit.leave));
  s.querySelector('.online-boxes')!.append(joinCode ? joinBox : hostBox, joinCode ? hostBox : joinBox);
}

// --- Hosting ---

function inviteLink(): string {
  return `${location.origin}${location.pathname}#join=${host!.room.code}${host!.fp ? `.${host!.fp}` : ''}`;
}

function hostScreen(s: HTMLElement) {
  const { h, t, button } = kit;
  const r = host!.room;
  if (r.game) {
    table(s, host!.view, r.members.some((m) => m.id === r.hostId) ? host!.mine : { ...host!.mine, seat: null }, true);
    const tools = h('div', 'menu host-tools');
    tools.append(
      button('🏁 Back to the lobby', 'big secondary', () =>
        kit.openOverlay('Back to the lobby?', (box) => {
          box.append(t('p', '', 'This game ends for everyone, and the table goes back to the lobby (same people).'));
          box.append(
            button('Yes', 'big danger', () => {
              backToLobby(r);
              void host!.changed();
              kit.closeOverlay();
            }),
            button('Keep playing', 'big secondary', kit.closeOverlay),
          );
        }),
      ),
    );
    s.append(tools);
    return;
  }
  s.append(t('h2', 'screen-title', '🎙️ Your room'));
  const code = h('div', 'room-code');
  code.append(t('small', '', 'Room code'), t('b', '', r.code));
  s.append(code);
  const status = t('p', 'share-status', host!.status === 'connected' ? 'Connected. Share the link in Discord, or read out the code.' : host!.status === 'lost' ? '⚠️ Connection lost. Trying again…' : 'Connecting…');
  s.append(
    status,
    button('🔗 Copy invite link', 'big', () => {
      void navigator.clipboard.writeText(inviteLink()).then(
        () => (status.textContent = '✅ Invite link copied. Paste it in Discord.'),
        () => (status.textContent = inviteLink()),
      );
    }),
  );
  s.append(t('h3', 'section', `👥 At the table · ${r.members.length}/${MAX_PLAYERS}`));
  const list = h('ul', 'online-members');
  for (const m of r.members) {
    const li = h('li', m.bot ? 'bot' : '');
    const on = m.bot || m.id === r.hostId || host!.online.has(m.id);
    li.append(t('span', 'who', `${on ? '🟢' : '⚪'} ${m.bot ? '🤖 ' : ''}${m.name}${m.id === r.hostId ? ' (you, hosting)' : ''}`));
    if (m.id !== r.hostId) li.append(button('✕', 'kick', () => removeMember(r, m.id) && void host!.changed()));
    list.append(li);
  }
  if (!r.members.length) list.append(t('li', 'muted', 'Nobody yet. Share the link!'));
  s.append(list);
  const row = h('div', 'menu');
  row.append(button('🤖 Add a bot', 'big secondary', () => addBot(r) && void host!.changed(), r.members.length >= MAX_PLAYERS));
  const sides = h('div', 'party-count');
  for (const [mode, label] of [['ancap', '🦅 Ancapball'], ['mirror', '🪞 Austria']] as [Mode, string][]) {
    sides.append(
      button(label, `mode-tab${r.mode === mode ? ' picked' : ''}`, () => {
        r.mode = mode;
        void host!.changed();
      }),
    );
  }
  s.append(row, sides);
  const n = r.members.length;
  s.append(t('p', 'muted', n >= MIN_PLAYERS ? `${TABLES[n].impostors} impostor${TABLES[n].impostors === 1 ? '' : 's'} at a table of ${n}.` : `You need ${MIN_PLAYERS} to ${MAX_PLAYERS} at the table (bots count).`));
  s.append(
    button(canStart(r) ? `▶ Deal the roles (${n} players)` : `Waiting for players (${n}/${MIN_PLAYERS})`, 'big', () => {
      if (start(r, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)) void host!.changed();
    }, !canStart(r)),
    button('🚪 Close the room', 'big secondary', () => {
      closeAll(true);
      refresh();
    }),
  );
}

// --- Playing ---

function playerScreen(s: HTMLElement) {
  const { h, t, button } = kit;
  const p = player!;
  const v = p.view;
  if (p.mismatch) s.append(t('p', 'fired-note bad', '⚠️ Someone on this channel isn’t the host from your invite link. Ignoring them.'));
  if (!v) {
    s.append(t('h2', 'screen-title', `🚪 Room ${p.data.code}`));
    s.append(t('p', 'pitch', p.status === 'connected' ? 'Connected. Waiting for the host to answer… (they need the room open on their screen)' : p.status === 'lost' ? '⚠️ Connection lost. Trying again…' : 'Connecting…'));
  } else if (!v.started) {
    s.append(t('h2', 'screen-title', `🚪 Room ${v.code}`));
    s.append(t('p', 'pitch', `${v.hostName ? `${v.hostName} is hosting.` : 'Hosted on a shared screen.'} Waiting for the host to deal the roles. Side: ${v.mode === 'mirror' ? '🪞 Austria' : '🦅 Ancapball'}.`));
    const list = h('ul', 'online-members');
    for (const m of v.lobby) list.append(t('li', m.bot ? 'bot' : '', `${m.bot ? '🤖 ' : ''}${m.name}${m.host ? ' (host)' : ''}`));
    s.append(list);
    if (p.mine?.seat === null) s.append(t('p', 'muted', 'The table is full: you’re watching.'));
  } else table(s, v, p.mine, false);
  s.append(
    button('🚪 Leave the room', 'big secondary', () => {
      closeAll(true);
      refresh();
    }),
  );
}

/** Names of the seats we're waiting on. */
const waitingNames = (v: PublicView) => v.waiting.map((i) => v.players[i]?.name).filter(Boolean).join(', ');

function table(s: HTMLElement, v: PublicView, mine: PrivateView | null, isHost: boolean) {
  const { h, t, button, ball, effectChips } = kit;
  const sd = sideOf(v.mode);
  const seat = mine?.seat ?? null;
  const me = seat !== null ? v.players[seat] : null;
  const chairName = v.players[v.chair]?.name ?? '?';
  // The host can act for the Chair, but only on purpose (a bot Chair acts by itself).
  const standingIn = (mine?.chairing ?? false) && seat !== v.chair;
  const phaseKey = `${v.quarter}:${v.phase}`;
  const iChair = (mine?.chairing ?? false) && (!standingIn || override === phaseKey);
  const offerOverride = standingIn && !iChair && !v.players[v.chair]?.bot && ['briefing', 'table', 'result', 'voted'].includes(v.phase ?? '');
  const chairAction = (label: string, intent: Intent, cls = 'big') => button(`${label}${standingIn ? ' <small>(standing in for the Chair)</small>' : ''}`, cls, () => send(intent));
  const waitLine = (what: string) => t('p', 'online-wait', `⏳ ${what}${v.waiting.length ? `: ${waitingNames(v)}` : ''}`);
  if (v.phase && v.phase !== lastPhase) {
    if (v.phase === 'voted' && v.lastVote?.fired !== null && v.lastVote) kit.play(v.players[v.lastVote.fired].impostor ? 'caught' : 'oops');
    if (v.phase === 'over') kit.play(v.ending === 'term' || v.ending === 'purged' ? 'win' : 'lose');
    lastPhase = v.phase;
  }

  // Who's at the table: the Chair, the fired (and what they were), records, and who we're waiting on.
  const roster = h('div', 'roster');
  v.players.forEach((p, i) => {
    const chip = h('span', `roster-chip${p.fired ? ' fired' : ''}${i === seat ? ' me' : ''}${v.waiting.includes(i) ? ' waiting' : ''}`);
    chip.textContent = `${v.waiting.includes(i) ? '⏳ ' : ''}${p.fired ? (p.impostor ? '🔥 ' : '😬 ') : i === v.chair ? '🪑 ' : ''}${p.bot ? '🤖 ' : ''}${p.name}${i === seat ? ' (you)' : ''}${p.fired ? ` (${p.impostor ? sd.role.impostor : sd.role.loyal})` : p.bad || p.good ? ` · ${'✅'.repeat(p.good)}${'❌'.repeat(p.bad)}` : ''}`;
    roster.append(chip);
  });

  // Your secret, a tap away (in case you forget which side you're on).
  const secret = () => {
    if (seat === null || !mine) return null;
    return button('🔒 My role', 'mode-tab my-role', () =>
      kit.openOverlay('🔒 Only you can see this', (box) => {
        box.append(ball({ flag: mine.impostor ? sd.impostorFlag : sd.council, eyes: mine.impostor ? 'shifty' : 'happy', hat: mine.impostor ? 'tyrolean' : 'top' }, 'big-ball'));
        box.append(t('p', `role-name ${mine.impostor ? 'bad' : 'good'}`, mine.impostor ? `${sd.role.impostor} · an impostor` : sd.role.loyal));
        box.append(t('p', 'pitch', mine.impostor ? sd.party.impostorGoal : sd.party.loyalGoal));
        if (mine.fellows.length) box.append(t('p', 'friends', `Your fellow impostor${mine.fellows.length === 1 ? '' : 's'}: ${mine.fellows.join(', ')}.`));
      }),
    );
  };
  const roleBtn = secret();

  switch (v.phase) {
    case 'roles': {
      if (seat !== null && mine) {
        s.classList.add('secret');
        s.append(t('h2', 'screen-title', `${me!.name}, you are…`));
        s.append(ball({ flag: mine.impostor ? sd.impostorFlag : sd.council, eyes: mine.impostor ? 'shifty' : 'happy', hat: mine.impostor ? 'tyrolean' : 'top' }, 'big-ball'));
        s.append(t('p', `role-name ${mine.impostor ? 'bad' : 'good'}`, mine.impostor ? `${sd.role.impostor} · an impostor` : sd.role.loyal));
        s.append(t('p', 'pitch', mine.impostor ? sd.party.impostorGoal : sd.party.loyalGoal));
        if (mine.fellows.length) s.append(t('p', 'friends', `Your fellow impostor${mine.fellows.length === 1 ? '' : 's'}: ${mine.fellows.join(', ')}.`));
        if (!mine.seenRole) s.append(button('Got it', 'big', () => send({ type: 'seen' })));
        else s.append(waitLine('Waiting for everyone to read their role'));
      } else s.append(t('h2', 'screen-title', '🤫 Everyone’s reading their secret role'), waitLine('Waiting'));
      break;
    }
    case 'briefing': {
      s.append(t('h2', 'screen-title', `📰 ${kit.quarterLabel(v.quarter)}`));
      const list = h('ul', 'news');
      for (const n of v.news) {
        const li = h('li', `news-item${n.good === false ? ' bad' : n.good ? ' good' : ''}`);
        li.append(t('span', 'news-text', n.text), effectChips(n.effect));
        if (n.policy && n.proposer !== undefined) li.append(t('small', 'news-who', `“${policyOf(n.policy).title}”, proposed by ${v.players[n.proposer]?.name ?? '?'}`));
        list.append(li);
      }
      const c = crisisFor(v.crisis!, v.mode);
      const card = h('div', 'crisis');
      card.append(t('span', 'crisis-emoji', c.emoji), t('h3', '', c.title), t('p', '', c.text));
      s.append(list, card, t('p', 'chair', `🪑 Chair this quarter: ${chairName}`));
      s.append(iChair ? chairAction('Deal the policies ▶', { type: 'deal' }) : waitLine(`Waiting for ${chairName} (the Chair) to deal`));
      break;
    }
    case 'propose': {
      const c = crisisFor(v.crisis!, v.mode);
      if (mine?.hand) {
        s.classList.add('secret');
        s.append(t('h2', 'screen-title', `${c.emoji} Propose one`), t('p', 'muted', 'Only you can see what these really are.'));
        const hand = h('div', 'proposals');
        for (const id of mine.hand) {
          const pol = policyOf(id);
          const card = h('div', `proposal kind-${pol.kind}`);
          card.append(t('small', 'kind', sd.party.kinds[pol.kind]), t('b', 'proposal-title', pol.title), t('q', 'pitch', pol.pitch), button('Propose this', 'enact', () => send({ type: 'propose', policy: id })));
          hand.append(card);
        }
        s.append(hand);
        if (mine.fellows.length) s.append(t('p', 'friends', `Your fellow impostor${mine.fellows.length === 1 ? '' : 's'}: ${mine.fellows.join(', ')}.`));
      } else {
        s.append(t('h2', 'screen-title', `${c.emoji} ${c.title}`));
        if (mine?.proposed) s.append(t('p', 'pitch', `You proposed “${policyOf(mine.proposed).title}”.`));
        s.append(waitLine('Waiting for proposals'));
      }
      break;
    }
    case 'table': {
      const c = crisisFor(v.crisis!, v.mode);
      s.append(h('h2', 'screen-title', `${c.emoji} <span></span>`));
      s.querySelector('.screen-title span')!.textContent = c.title;
      s.append(t('p', 'pitch', iChair ? 'Argue it out on voice. Then enact one.' : `Argue it out on voice. Then ${chairName}, the Chair, enacts one.`));
      const props = h('div', 'proposals');
      v.proposals.forEach((p, i) => {
        const pol = policyOf(p.policy);
        const card = h('div', 'proposal');
        card.append(t('small', 'proposer', `🙋 ${v.players[p.player]?.name ?? '?'}`), t('b', 'proposal-title', pol.title), t('q', 'pitch', pol.pitch));
        if (iChair) card.append(button(`Enact${standingIn ? ' <small>(for the Chair)</small>' : ''}`, 'enact', () => send({ type: 'enact', index: i })));
        props.append(card);
      });
      s.append(props);
      break;
    }
    case 'result': {
      const last = v.lastEnacted;
      s.append(t('h2', 'screen-title', '✍️ Enacted'));
      if (last) {
        const pol = policyOf(last.policy);
        const card = h('div', 'enacted');
        card.append(t('b', '', pol.title), t('small', 'proposer', `Proposed by ${v.players[last.proposer]?.name ?? '?'}`), effectChips(pol.now));
        card.append(t('p', 'later', `Its real effect lands ${pol.later.in === 1 ? 'next quarter' : 'in two quarters'}${v.quarter + pol.later.in > QUARTERS ? ', after the term (it won’t count)' : ''}.`));
        s.append(card);
      }
      if (iChair) {
        const row = h('div', 'menu');
        row.append(chairAction('🔥 Hold a firing vote', { type: 'callVote' }, 'big danger'), chairAction(v.quarter >= QUARTERS ? 'End the term ▶' : 'Next quarter ▶', { type: 'next' }));
        s.append(row);
      } else s.append(waitLine(`${chairName} (the Chair) decides: a firing vote, or the next quarter`));
      break;
    }
    case 'vote': {
      if (mine?.canVote && seat !== null) {
        s.classList.add('secret');
        s.append(t('h2', 'screen-title', 'Fire someone?'), t('p', 'muted', 'A majority of the table fires them. Your vote is secret.'));
        const box = h('div', 'ballot');
        v.players.forEach((p, i) => {
          if (p.fired || i === seat) return;
          box.append(button('', 'ask', () => send({ type: 'vote', target: i })));
          box.lastElementChild!.textContent = `🔥 ${p.name}`;
        });
        box.append(button('Nobody', 'ask nobody', () => send({ type: 'vote', target: -1 })));
        s.append(box);
      } else {
        s.append(t('h2', 'screen-title', '🗳️ Secret ballot'));
        if (mine?.voted !== null && mine?.voted !== undefined) s.append(t('p', 'pitch', `You voted: ${mine.voted === -1 ? 'nobody' : v.players[mine.voted]?.name}.`));
        s.append(waitLine('Waiting for votes'));
      }
      break;
    }
    case 'voted': {
      const lv = v.lastVote!;
      s.append(t('h2', 'screen-title', '🗳️ The votes are in'));
      const tally = h('ul', 'tally');
      for (const [target, n] of Object.entries(lv.tally).sort((a, b) => b[1] - a[1])) tally.append(t('li', '', `${Number(target) === -1 ? 'Nobody' : v.players[Number(target)]?.name}: ${n} vote${n === 1 ? '' : 's'}`));
      s.append(tally);
      if (lv.fired === null) s.append(t('p', 'pitch', 'No majority. Nobody is fired.'));
      else {
        const p = v.players[lv.fired];
        s.append(ball({ flag: p.impostor ? sd.impostorFlag : sd.council, eyes: p.impostor ? 'shifty' : 'shocked' }, 'big-ball'));
        s.append(t('p', `role-name ${p.impostor ? 'good' : 'bad'}`, `${p.name} is fired. ${p.impostor ? `${sd.role.impostor}: an impostor!` : `${sd.role.loyal}: loyal. Oops.`}`));
      }
      s.append(iChair ? chairAction(v.quarter >= QUARTERS ? 'End the term ▶' : 'Next quarter ▶', { type: 'next' }) : waitLine(`Waiting for ${chairName} to move on`));
      break;
    }
    case 'over': {
      const loyalWon = v.ending === 'term' || v.ending === 'purged';
      const [title, line] = sd.endings[v.ending!];
      s.classList.add('end', loyalWon ? 'won' : 'lost');
      s.append(t('h2', 'end-title', loyalWon ? sd.party.loyalWin : sd.party.impostorsWin), t('p', 'end-sub', title), t('p', 'pitch', line));
      if (me) s.append(t('p', 'meta', me.impostor === !loyalWon ? '🎉 Your side won.' : '😿 Your side lost.'));
      const grid = h('div', 'reveal-grid');
      for (const p of v.players) {
        const card = h('div', `reveal-card ${p.impostor ? 'impostor' : 'real'}`);
        card.append(ball({ flag: p.impostor ? sd.impostorFlag : sd.council, eyes: p.impostor ? 'shifty' : 'happy' }), t('b', '', p.name), t('small', 'role', p.impostor ? sd.role.impostor : sd.role.loyal), t('small', '', p.fired ? '🔥 Fired' : 'Stayed'));
        grid.append(card);
      }
      s.append(grid);
      if (isHost && host) {
        s.append(
          button('▶ Same table, new game', 'big', () => {
            backToLobby(host!.room);
            start(host!.room, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
            void host!.changed();
          }),
        );
      } else s.append(t('p', 'muted', 'The host can start another game with the same table.'));
      break;
    }
  }
  if (offerOverride) {
    s.append(
      button('🙋 The Chair’s away? Act for them', 'mode-tab', () => {
        override = phaseKey;
        refresh();
      }),
    );
  }
  if (v.phase !== 'over') s.append(roster);
  if (roleBtn && v.phase !== 'roles' && v.phase !== 'over') s.append(roleBtn);
}
