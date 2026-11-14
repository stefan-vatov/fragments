// Minimal Chrome DevTools Protocol client for the headless harness.
//
// Extracted so its failure modes can be regression-tested with a fake socket:
// a renderer that closes or crashes must fail in-flight requests immediately
// instead of letting each one wait out its timeout.
export async function connect(target, { timeout = 15_000 } = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error("Cannot connect to the debugging target"));
  });
  let id = 0;
  const pending = new Map();
  const failAll = (reason) => {
    for (const [requestId, request] of pending) {
      clearTimeout(request.timer);
      pending.delete(requestId);
      request.reject(reason);
    }
  };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  socket.onclose = () => failAll(new Error("The debugging target closed"));
  socket.onerror = () => failAll(new Error("The debugging connection failed"));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      if (socket.readyState !== 1) {
        reject(new Error(`Not connected: ${method}`));
        return;
      }
      const requestId = ++id;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timed out: ${method}`));
      }, timeout);
      pending.set(requestId, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id: requestId, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  return {
    send,
    evaluate,
    close: () => {
      failAll(new Error("The debugging session was closed"));
      socket.close();
    },
  };
}
