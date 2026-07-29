import { expect, it, vi } from "vitest";
import { DisposableScope } from "../src/index";

it("disposes every tracked resource exactly once", () => {
  const firstDispose = vi.fn();
  const secondDispose = vi.fn();
  const scope = new DisposableScope();
  scope.track({ dispose: firstDispose });
  scope.track({ dispose: secondDispose });
  scope.dispose();
  scope.dispose();
  expect(firstDispose).toHaveBeenCalledTimes(1);
  expect(secondDispose).toHaveBeenCalledTimes(1);
});

it("does not accept new resources after disposal", () => {
  const scope = new DisposableScope();
  scope.dispose();
  expect(() => scope.track({ dispose() {} })).toThrow("DisposableScope is already disposed");
});

it("continues disposal after an earlier resource throws and does not retry resources", () => {
  const firstDispose = vi.fn(() => {
    throw new Error("first resource failed");
  });
  const secondDispose = vi.fn();
  const scope = new DisposableScope();
  scope.track({ dispose: firstDispose });
  scope.track({ dispose: secondDispose });

  expect(() => scope.dispose()).toThrow("first resource failed");
  expect(firstDispose).toHaveBeenCalledTimes(1);
  expect(secondDispose).toHaveBeenCalledTimes(1);

  scope.dispose();
  expect(firstDispose).toHaveBeenCalledTimes(1);
  expect(secondDispose).toHaveBeenCalledTimes(1);
});
