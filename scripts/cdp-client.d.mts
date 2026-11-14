export interface CdpClient {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  close(): void;
}
export function connect(
  target: { webSocketDebuggerUrl?: string },
  options?: { timeout?: number },
): Promise<CdpClient>;
