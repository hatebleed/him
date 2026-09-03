import "server-only";

import { EventEmitter } from "node:events";

import { logger } from "@/lib/logger";

/**
 * Realtime abstraction.
 *
 * Application code publishes domain events; the transport is pluggable. The
 * default `local` bus fans out in-process and is consumed by the SSE endpoint
 * (`/api/realtime/stream`). Swapping in Redis/WebSockets later means adding a
 * provider - no module code changes.
 */
export type DomainEventType =
  | "notification.created"
  | "message.created"
  | "unit.status.changed"
  | "call.created"
  | "call.updated"
  | "incident.updated"
  | "record.updated"
  | "workflow.completed"
  | "task.updated";

export type DomainEvent = {
  type: DomainEventType | string;
  userId?: string;
  channelId?: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
};

export interface RealtimeProvider {
  publish(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}

class LocalEventBus implements RealtimeProvider {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: DomainEvent): void {
    this.emitter.emit("event", { ...event, occurredAt: event.occurredAt ?? new Date().toISOString() });
  }

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}

const bus = new LocalEventBus();

export function publish(event: DomainEvent): void {
  bus.publish(event);
}

export function subscribe(listener: (event: DomainEvent) => void): () => void {
  return bus.subscribe(listener);
}

/** True when the event is relevant to a subscriber's session. */
export function isEventForUser(event: DomainEvent, userId: string, channelIds: string[]): boolean {
  if (event.userId && event.userId !== userId) return false;
  if (event.channelId && !channelIds.includes(event.channelId)) return false;
  return true;
}

export const realtimeLogger = logger;
