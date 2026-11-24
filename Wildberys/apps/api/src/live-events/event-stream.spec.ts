import type { MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { concernsSeller } from './audience.js';
import { eventStream, heartbeatMilliseconds } from './event-stream.js';
import type { LiveEvent } from './live-events.js';

const mine = '0193a7c2-0000-7000-8000-000000000001';
const other = '0193a7c2-0000-7000-8000-000000000002';
const conversation = '0193a7c2-0000-7000-8000-000000000003';
const minute = 60_000;

describe('eventStream', () => {
  let events: Subject<LiveEvent>;
  let sent: MessageEvent[];
  let ended: boolean;

  /** Opens a stream for the person of one seller, for ten minutes. */
  function open(): void {
    eventStream(events, concernsSeller(mine), new Date(Date.now() + 10 * minute)).subscribe({
      next: (message) => sent.push(message),
      complete: () => {
        ended = true;
      },
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject();
    sent = [];
    ended = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says "ready" first, and tells the browser how soon to come back', () => {
    open();

    expect(sent).toEqual([{ type: 'ready', retry: 1000, data: {} }]);
  });

  it('passes on a change that concerns the person: what changed, never the content', () => {
    open();
    events.next({ kind: 'conversation-changed', sellerId: mine, conversationId: conversation });
    events.next({ kind: 'seller-changed', sellerId: mine });

    expect(sent.slice(1)).toEqual([
      {
        type: 'change',
        data: { kind: 'conversation-changed', sellerId: mine, conversationId: conversation },
      },
      { type: 'change', data: { kind: 'seller-changed', sellerId: mine } },
    ]);
  });

  it('keeps a change of somebody else to itself', () => {
    open();
    events.next({ kind: 'conversation-changed', sellerId: other, conversationId: conversation });
    events.next({ kind: 'seller-changed', sellerId: other });
    events.next({ kind: 'newsletter-changed' });

    expect(sent).toHaveLength(1);
  });

  it('says "ready" again when changes may have been missed', () => {
    open();
    events.next({ kind: 'events-missed' });

    expect(sent.map(({ type }) => type)).toEqual(['ready', 'ready']);
  });

  it('sends a line while it has nothing to say', () => {
    open();
    vi.advanceTimersByTime(heartbeatMilliseconds * 2);

    expect(sent.slice(1)).toEqual([{ comment: 'open' }, { comment: 'open' }]);
    expect(ended).toBe(false);
  });

  it('ends with the access token it was opened with', () => {
    open();
    vi.advanceTimersByTime(10 * minute - 1);

    expect(ended).toBe(false);

    vi.advanceTimersByTime(1);

    expect(ended).toBe(true);
  });

  it('ends when the API stops', () => {
    open();
    events.complete();

    expect(ended).toBe(true);
  });
});
