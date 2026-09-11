// ─── MultiplayerClient ────────────────────────────────────────────────────────
// Browser-side WebSocket singleton with auto-reconnect.
// Used as a React context value — no singletons outside the hook.

import type { ClientMessage, ServerMessage } from './types';

export type MessageHandler = (msg: ServerMessage) => void;
export type StatusHandler = (connected: boolean) => void;

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:3001`
    : 'ws://localhost:3001');

const RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL_MS = 25_000;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Connection ───────────────────────────────────────────────────────────────

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionalClose = false;
    this._open();
  }

  disconnect() {
    this.intentionalClose = true;
    this._clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._notifyStatus(false);
  }

  private _open() {
    try {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this._notifyStatus(true);
        this._startPing();
      };

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;
          for (const h of this.messageHandlers) h(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        this._stopPing();
        this._notifyStatus(false);
        if (!this.intentionalClose) {
          this._scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror, so reconnect handled there
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this._open(), RECONNECT_DELAY_MS);
  }

  private _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'PING', ts: Date.now() });
    }, PING_INTERVAL_MS);
  }

  private _stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private _clearTimers() {
    this._stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private _notifyStatus(connected: boolean) {
    for (const h of this.statusHandlers) h(connected);
  }

  // ── Messaging ────────────────────────────────────────────────────────────────

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
