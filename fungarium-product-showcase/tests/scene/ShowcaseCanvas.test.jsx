import { render } from "@testing-library/react";
import { ShowcaseCanvas } from "../../src/components/scene/ShowcaseCanvas";

const rendererHarness = vi.hoisted(() => ({
  backend: "webgl",
  canvasProps: null,
  webglInstances: [],
  webgpuInstance: null,
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: (props) => {
    rendererHarness.canvasProps = props;
    return null;
  },
  useFrame: vi.fn(),
}));

vi.mock("@react-three/drei", () => ({
  Html: () => null,
  OrbitControls: () => null,
}));

vi.mock("three", async () => {
  const actual = await vi.importActual("three");

  class WebGLRenderer {
    constructor(options) {
      this.options = options;
      this.domElement = { toDataURL: vi.fn(() => "data:image/png;base64,") };
      rendererHarness.webglInstances.push(this);
    }
  }

  return { ...actual, WebGLRenderer };
});

vi.mock("three/webgpu", () => ({
  WebGPURenderer: class WebGPURenderer {
    constructor(options) {
      this.options = options;
      this.backend =
        rendererHarness.backend === "webgpu"
          ? { isWebGPUBackend: true }
          : { isWebGLBackend: true };
      this.dispose = vi.fn();
      rendererHarness.webgpuInstance = this;
    }

    async init() {}
  },
}));

beforeEach(() => {
  rendererHarness.backend = "webgl";
  rendererHarness.canvasProps = null;
  rendererHarness.webglInstances = [];
  rendererHarness.webgpuInstance = null;
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {},
  });
});

afterEach(() => {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: undefined,
  });
});

test("replaces WebGPURenderer internal WebGL fallback with capture-safe WebGLRenderer", async () => {
  render(<ShowcaseCanvas />);

  const renderer = await rendererHarness.canvasProps.gl({ canvas: {} });

  expect(renderer).toBe(rendererHarness.webglInstances[0]);
  expect(rendererHarness.webgpuInstance.dispose).toHaveBeenCalledOnce();
  expect(renderer.options.preserveDrawingBuffer).toBe(true);
  expect(renderer.__showcaseRenderer).toBe("webgl");
});

test("keeps an initialized renderer whose actual backend is WebGPU", async () => {
  rendererHarness.backend = "webgpu";
  render(<ShowcaseCanvas />);

  const renderer = await rendererHarness.canvasProps.gl({ canvas: {} });

  expect(renderer).toBe(rendererHarness.webgpuInstance);
  expect(rendererHarness.webglInstances).toHaveLength(0);
  expect(renderer.__showcaseRenderer).toBe("webgpu");
});
