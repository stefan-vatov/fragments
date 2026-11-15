import { describe, expect, it } from "vitest";
import { FragmentsView } from "../src/view";

const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const setup = () => {
  const view = new FragmentsView({} as never, {} as never);
  const install = (shell: unknown): void =>
    (view as unknown as { install(value: unknown): void }).install(shell);
  return { view, install };
};

const settles = (promise: Promise<void>): Promise<string> =>
  Promise.race([promise.then(() => "settled"), tick(60).then(() => "pending")]);

describe("queued view actions", () => {
  it("settles when the installed shell rejects", async () => {
    const { view, install } = setup();
    const queued = view.createFragment();
    install({
      createFragment: async () => {
        throw new Error("boom");
      },
    });
    await expect(settles(queued)).resolves.toBe("settled");
  });

  it("settles when the installed shell throws synchronously", async () => {
    const { view, install } = setup();
    const queued = view.saveDraft();
    expect(() =>
      install({
        saveDraft: () => {
          throw new Error("boom");
        },
      }),
    ).not.toThrow();
    await expect(settles(queued)).resolves.toBe("settled");
  });
});
