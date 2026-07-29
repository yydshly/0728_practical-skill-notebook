import { describe, expect, it } from "vitest";
import { fallbackDetails } from "../src/ui/render-fallback";

describe("fallback details", () => {
  it("keeps the actionable WebGL failure cause distinct from model failures", () => {
    expect(fallbackDetails("webgl-unavailable").title).toBe("3D 预览不可用");
    expect(fallbackDetails("renderer-init-failed").message).toContain("渲染器");
    expect(fallbackDetails("model-creation-failed").message).toContain("模型");
  });
});
