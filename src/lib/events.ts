type ForgeEvent = {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

const encoder = new TextEncoder();

type Subscriber = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

const globalBus = globalThis as unknown as {
  forgeSubscribers?: Map<string, Subscriber>;
};

const subscribers = globalBus.forgeSubscribers ?? new Map<string, Subscriber>();
globalBus.forgeSubscribers = subscribers;

function toSseMessage(event: ForgeEvent) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function publishEvent(type: string, payload: Record<string, unknown>) {
  const event = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  } satisfies ForgeEvent;

  for (const subscriber of subscribers.values()) {
    try {
      subscriber.controller.enqueue(toSseMessage(event));
    } catch {
      subscribers.delete(subscriber.id);
    }
  }

  return event;
}

export function createEventStream() {
  const subscriberId = crypto.randomUUID();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      subscribers.set(subscriberId, { id: subscriberId, controller });
      controller.enqueue(
        toSseMessage({
          type: "stream.connected",
          payload: { subscriberId },
          timestamp: new Date().toISOString(),
        }),
      );
    },
    cancel() {
      subscribers.delete(subscriberId);
    },
  });
}