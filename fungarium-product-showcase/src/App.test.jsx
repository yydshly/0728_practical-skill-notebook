import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

vi.mock("./components/scene/ShowcaseCanvas", () => ({
  ShowcaseCanvas: () => <div data-testid="interactive-showroom" />,
}));

test("renders the client showroom landmark", () => {
  render(<App />);
  expect(
    screen.getByRole("main", { name: "产品能力展厅" }),
  ).toBeInTheDocument();
});

test("renders the interactive showroom when only WebGPU is available", () => {
  const originalWebgl = window.WebGLRenderingContext;
  const originalWebgl2 = window.WebGL2RenderingContext;
  const originalGpu = navigator.gpu;

  Object.defineProperty(window, "WebGLRenderingContext", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, "WebGL2RenderingContext", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {},
  });

  try {
    render(<App />);
    expect(screen.getByTestId("interactive-showroom")).toBeInTheDocument();
  } finally {
    Object.defineProperty(window, "WebGLRenderingContext", {
      configurable: true,
      value: originalWebgl,
    });
    Object.defineProperty(window, "WebGL2RenderingContext", {
      configurable: true,
      value: originalWebgl2,
    });
    if (originalGpu === undefined) {
      delete navigator.gpu;
    } else {
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: originalGpu,
      });
    }
  }
});
