import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResizeObserver } from "./useResizeObserver";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }
}

function Harness() {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  return (
    <div>
      <div ref={ref} data-testid="target" />
      <output data-testid="size">{`${width}x${height}`}</output>
    </div>
  );
}

describe("useResizeObserver", () => {
  afterEach(() => {
    ResizeObserverMock.instances = [];
  });

  it("observes element and updates dimensions", async () => {
    const original = globalThis.ResizeObserver;
    // @ts-expect-error - test mock
    globalThis.ResizeObserver = ResizeObserverMock;

    try {
      render(<Harness />);

      expect(screen.getByTestId("size").textContent).toBe("0x0");
      expect(ResizeObserverMock.instances).toHaveLength(1);

      const instance = ResizeObserverMock.instances[0];
      await waitFor(() => {
        expect(instance.observe).toHaveBeenCalledTimes(1);
      });

      const target = screen.getByTestId("target");
      await act(async () => {
        instance.callback(
          [
            {
              target,
              contentRect: {
                width: 320,
                height: 180,
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: 320,
                bottom: 180,
                toJSON: () => ({}),
              },
            } as ResizeObserverEntry,
          ],
          // @ts-expect-error - acceptable in test
          instance,
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("size").textContent).toBe("320x180");
      });
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
