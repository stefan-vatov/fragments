import { afterEach, describe, expect, it } from "vitest";
import { connect } from "../scripts/cdp-client.mjs";

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("CDP client", () => {
  afterEach(() => {
    FakeSocket.instances = [];
  });

  it("rejects in-flight requests as soon as the target closes", async () => {
    const realWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    try {
      const connecting = connect({ webSocketDebuggerUrl: "ws://target" });
      const socket = FakeSocket.instances[0];
      socket.readyState = 1;
      socket.onopen?.();
      const client = await connecting;

      const request = client.send("Runtime.evaluate", {});
      socket.close();
      await expect(request).rejects.toThrow("closed");
    } finally {
      globalThis.WebSocket = realWebSocket;
    }
  });

  it("resolves a response and fails pending work on close()", async () => {
    const realWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    try {
      const connecting = connect({ webSocketDebuggerUrl: "ws://target" });
      const socket = FakeSocket.instances[0];
      socket.readyState = 1;
      socket.onopen?.();
      const client = await connecting;

      const request = client.send("Runtime.evaluate", { expression: "1 + 1" });
      const sent = JSON.parse(socket.sent[0]) as { id: number };
      socket.onmessage?.({
        data: JSON.stringify({ id: sent.id, result: { result: { value: 2 } } }),
      });
      await expect(request).resolves.toEqual({ result: { value: 2 } });

      const pending = client.send("Runtime.evaluate", {});
      client.close();
      await expect(pending).rejects.toThrow("closed");
    } finally {
      globalThis.WebSocket = realWebSocket;
    }
  });
});
