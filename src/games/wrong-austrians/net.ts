// Online party mode, the wire: a Supabase Realtime channel per room, and end-to-end encryption so
// nobody else on the channel (or snooping on it) can read anyone's role, hand or vote. Every device
// makes an ECDH key pair; the host and each player derive a shared AES-GCM key; everything the host
// sends a player, and every move a player sends the host, is sealed with it. The room code only
// finds the channel; an invite link also carries the host's key fingerprint, so a joiner can't be
// fooled by someone pretending to host.

import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import { act, botMoves, type Intent, join, privateView, type PrivateView, publicView, type PublicView, type Room } from './online.ts';

/** The lolbertarianism Supabase project. The publishable key is meant to be public. */
const REALTIME_URL = 'wss://wrzqgzxcuncnfegkikhr.supabase.co/realtime/v1';
const PUBLISHABLE_KEY = 'sb_publishable_xaiTIXVVyakDE6bYKrTf2A_azVD9Dm5';

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

const subtle = () => globalThis.crypto.subtle;
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface SavedKeys {
  pub: string;
  priv: JsonWebKey;
}

export interface Keys {
  pub: string;
  priv: CryptoKey;
}

export async function makeKeys(): Promise<{ keys: Keys; saved: SavedKeys }> {
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const pub = b64(await subtle().exportKey('raw', pair.publicKey));
  const priv = await subtle().exportKey('jwk', pair.privateKey);
  return { keys: { pub, priv: pair.privateKey }, saved: { pub, priv } };
}

export async function loadKeys(saved: SavedKeys): Promise<Keys> {
  const priv = await subtle().importKey('jwk', saved.priv, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  return { pub: saved.pub, priv };
}

/** The key two devices share: my private key and your public one. */
export async function sharedKey(mine: Keys, theirPub: string): Promise<CryptoKey> {
  const pub = await subtle().importKey('raw', unb64(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return subtle().deriveKey({ name: 'ECDH', public: pub }, mine.priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export interface Sealed {
  iv: string;
  ct: string;
}

export async function seal(key: CryptoKey, data: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Opens a sealed message (null if it wasn't sealed with this key: forged, or for someone else). */
export async function unseal<T>(key: CryptoKey, box: Sealed): Promise<T | null> {
  try {
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

/** A short fingerprint of a public key, for invite links. */
export async function fingerprint(pub: string): Promise<string> {
  const hash = new Uint8Array(await subtle().digest('SHA-256', unb64(pub)));
  return b64(hash).replace(/[+/=]/g, '').slice(0, 10);
}

export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------------------
// The channel
// ---------------------------------------------------------------------------

type Handler = (payload: Record<string, unknown>) => void;

/** One room's channel: broadcast messages, and presence (who's connected right now). */
class Line {
  private client: RealtimeClient;
  private channel: RealtimeChannel;
  private handlers = new Map<string, Handler>();
  online = new Set<string>();
  status: 'connecting' | 'connected' | 'lost' = 'connecting';

  constructor(code: string, me: string, private onChange: () => void) {
    this.client = new RealtimeClient(REALTIME_URL, { params: { apikey: PUBLISHABLE_KEY } });
    this.channel = this.client.channel(`wrong-austrians-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    for (const event of ['hello', 'host', 'to', 'act']) this.channel.on('broadcast', { event }, (msg) => this.handlers.get(event)?.(msg.payload as Record<string, unknown>));
    this.channel.on('presence', { event: 'sync' }, () => {
      this.online = new Set(Object.keys(this.channel.presenceState()));
      this.onChange();
    });
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  }

  connect(onReady: () => void) {
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.status = 'connected';
        void this.channel.track({ at: Date.now() });
        onReady();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.status = 'lost';
      this.onChange();
    });
  }

  send(event: string, payload: Record<string, unknown>) {
    if (this.status !== 'connected') return;
    void this.channel.send({ type: 'broadcast', event, payload });
  }

  close() {
    void this.channel.unsubscribe();
    this.client.disconnect();
  }
}

// ---------------------------------------------------------------------------
// The host: runs the room, answers everyone
// ---------------------------------------------------------------------------

export interface HostSave {
  room: Room;
  keys: SavedKeys;
  /** Each member's public key, pinned the first time they said hello (so nobody can steal a seat). */
  peers: Record<string, string>;
}

export class OnlineHost {
  private line: Line;
  private keys!: Keys;
  private shared = new Map<string, CryptoKey>();
  private botTimer = 0;
  fp = '';

  constructor(public data: HostSave, private onChange: () => void, private persist: (data: HostSave) => void) {
    this.line = new Line(data.room.code, data.room.hostId, onChange);
  }

  get room() {
    return this.data.room;
  }
  get online() {
    return this.line.online;
  }
  get status() {
    return this.line.status;
  }

  async start() {
    this.keys = await loadKeys(this.data.keys);
    this.fp = await fingerprint(this.keys.pub);
    for (const [id, pub] of Object.entries(this.data.peers)) this.shared.set(id, await sharedKey(this.keys, pub));
    this.line.on('hello', (p) => void this.hello(p));
    this.line.on('act', (p) => void this.incoming(p));
    this.line.connect(() => {
      this.announce();
      void this.publish();
    });
  }

  private announce() {
    this.line.send('host', { pub: this.keys.pub, fp: this.fp });
  }

  private async hello(p: Record<string, unknown>) {
    const id = String(p.id ?? '');
    const pub = String(p.pub ?? '');
    if (!id || !pub || id === this.room.hostId) return;
    const pinned = this.data.peers[id];
    if (pinned && pinned !== pub) return; // someone else claiming that seat
    if (!pinned) {
      this.data.peers[id] = pub;
      this.shared.set(id, await sharedKey(this.keys, pub));
    }
    join(this.room, id, String(p.name ?? ''));
    this.announce();
    await this.publish();
  }

  private async incoming(p: Record<string, unknown>) {
    const from = String(p.from ?? '');
    const key = this.shared.get(from);
    if (!key) return;
    const intent = await unseal<Intent>(key, p as unknown as Sealed);
    if (intent && act(this.room, from, intent)) await this.publish();
  }

  /** The host's own moves. */
  async act(intent: Intent) {
    if (act(this.room, this.room.hostId, intent)) await this.publish();
  }

  /** After a lobby change (bots, kicks, side, start, back to the lobby). */
  async changed() {
    await this.publish();
  }

  get view(): PublicView {
    return publicView(this.room);
  }
  get mine(): PrivateView {
    return privateView(this.room, this.room.hostId);
  }

  /** Everyone gets the table and their own secrets, sealed for them alone. */
  private async publish() {
    this.persist(this.data);
    this.onChange();
    const view = publicView(this.room);
    for (const [id, key] of this.shared) {
      const box = await seal(key, { view, mine: privateView(this.room, id) });
      this.line.send('to', { to: id, ...box });
    }
    this.scheduleBots();
  }

  private scheduleBots() {
    if (this.botTimer || !botMoves(this.room).length) return;
    this.botTimer = window.setTimeout(() => {
      this.botTimer = 0;
      // One bot move at a time, so it reads like people taking their turns.
      const [move] = botMoves(this.room);
      if (move && act(this.room, move.id, move.intent)) void this.publish();
    }, 650);
  }

  close() {
    window.clearTimeout(this.botTimer);
    this.line.close();
  }
}

// ---------------------------------------------------------------------------
// A player: says hello, gets the table and their secrets, sends moves
// ---------------------------------------------------------------------------

export interface PlayerSave {
  code: string;
  id: string;
  name: string;
  keys: SavedKeys;
  /** The host's fingerprint from the invite link (or the first host we heard from). */
  pin: string | null;
}

export class OnlinePlayer {
  private line: Line;
  private keys!: Keys;
  private hostKey: CryptoKey | null = null;
  private helloTimer = 0;
  view: PublicView | null = null;
  mine: PrivateView | null = null;
  /** Heard from a host, but its fingerprint didn't match the invite. */
  mismatch = false;
  lastHeard = 0;

  constructor(public data: PlayerSave, private onChange: () => void, private persist: (data: PlayerSave) => void) {
    this.line = new Line(data.code, data.id, onChange);
  }

  get online() {
    return this.line.online;
  }
  get status() {
    return this.line.status;
  }

  async start() {
    this.keys = await loadKeys(this.data.keys);
    this.line.on('host', (p) => void this.host(p));
    this.line.on('to', (p) => void this.incoming(p));
    this.line.connect(() => this.hello());
    // Keep saying hello until the host answers (it may not be there yet, or may have refreshed).
    this.helloTimer = window.setInterval(() => {
      if (Date.now() - this.lastHeard > 4000) this.hello();
    }, 3000);
  }

  private hello() {
    this.line.send('hello', { id: this.data.id, name: this.data.name, pub: this.keys.pub });
  }

  private async host(p: Record<string, unknown>) {
    const pub = String(p.pub ?? '');
    const fp = await fingerprint(pub);
    if (this.data.pin && fp !== this.data.pin) {
      this.mismatch = true;
      this.onChange();
      return;
    }
    if (!this.data.pin) {
      this.data.pin = fp;
      this.persist(this.data);
    }
    this.mismatch = false;
    const first = !this.hostKey;
    this.hostKey = await sharedKey(this.keys, pub);
    // The host's first answer may have raced ahead of its key: ask again.
    if (first && !this.view) this.hello();
  }

  private async incoming(p: Record<string, unknown>) {
    if (p.to !== this.data.id || !this.hostKey) return;
    const got = await unseal<{ view: PublicView; mine: PrivateView }>(this.hostKey, p as unknown as Sealed);
    if (!got) return;
    this.view = got.view;
    this.mine = got.mine;
    this.lastHeard = Date.now();
    this.persist(this.data);
    this.onChange();
  }

  async act(intent: Intent) {
    if (!this.hostKey) return;
    const box = await seal(this.hostKey, intent);
    this.line.send('act', { from: this.data.id, ...box });
  }

  close() {
    window.clearInterval(this.helloTimer);
    this.line.close();
  }
}
