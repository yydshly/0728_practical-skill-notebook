import { describe, expect, it } from "vitest";
import * as hudModule from "../src/ui/render-hud";

const formatters = hudModule as unknown as {
  formatPhaseLabel?(phase: string): string;
  formatEnemyLabel?(kind: string): string;
  formatMoveLabel?(moveId: string): string;
  formatTelegraphLabel?(kind: string, moveId: string): string;
  formatAttackResolutionCaption?(
    result: "hit" | "miss" | "interrupted",
  ): string;
};

describe("Chinese HUD presentation labels", () => {
  it.each([
    ["training", "训练阶段"],
    ["wave-one", "第一波"],
    ["elite", "精英战"],
    ["boss", "首领战"],
    ["complete", "挑战完成"],
  ])("maps phase %s without exposing its internal ID", (phase, expected) => {
    expect(formatters.formatPhaseLabel?.(phase)).toBe(expected);
  });

  it("combines enemy display name and move name for a telegraph", () => {
    expect(
      formatters.formatTelegraphLabel?.("ash-warden", "warden-bolt"),
    ).toBe("灰烬守望者 · 灰烬飞矢");
  });

  it("uses readable Chinese fallbacks without echoing unknown IDs", () => {
    expect(formatters.formatPhaseLabel?.("internal-phase-id")).toBe(
      "未知阶段",
    );
    expect(formatters.formatEnemyLabel?.("internal-enemy-id")).toBe(
      "未知敌人",
    );
    expect(formatters.formatMoveLabel?.("internal-move-id")).toBe(
      "未知招式",
    );
    expect(
      formatters.formatTelegraphLabel?.(
        "internal-enemy-id",
        "internal-move-id",
      ),
    ).toBe("未知敌人 · 未知招式");
  });

  it("presents an interrupted attack in direct Chinese", () => {
    expect(
      formatters.formatAttackResolutionCaption?.("interrupted"),
    ).toBe("攻击被打断");
  });
});
