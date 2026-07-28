import { describe, expect, it } from "vitest";
import { catalog, defaultConfiguration } from "../src/content/catalog";
import {
  hasConfigurationQuery,
  parseConfiguration,
  serializeConfiguration,
} from "../src/configuration/serialize-config";
import type { MechConfiguration } from "../src/configuration/types";
import { validateConfiguration } from "../src/configuration/validate-config";

describe("canonical configuration sharing", () => {
  it("recognizes only the canonical configuration keys as an explicit share", () => {
    for (const key of [
      "v",
      "c",
      "h",
      "a",
      "lw",
      "rw",
      "r",
      "p",
      "s",
      "m",
      "rf",
      "e",
    ]) {
      expect(hasConfigurationQuery(`?${key}=value`), key).toBe(true);
    }

    for (const search of [
      "",
      "?review=oracle-dusk",
      "?reviewControls=1",
      "?utm_source=v",
      "?version=1",
      "?vv=1",
    ]) {
      expect(hasConfigurationQuery(search), search).toBe(false);
    }
  });

  it("serializes defaults with only the required version and chassis keys", () => {
    expect(serializeConfiguration(defaultConfiguration)).toBe(
      "?v=1&c=strider-scout",
    );
  });

  it("uses the exact canonical key order and lower-case six-digit colors", () => {
    const config: MechConfiguration = {
      version: 1,
      chassisId: "oracle-frame",
      headId: "halo-head",
      armorId: "void-weave",
      leftWeaponId: "drone-rack",
      rightWeaponId: "rail-lance",
      rearModuleId: "field-relay",
      finish: {
        primary: "#A0B1C2",
        secondary: "#00FF7F",
        metalness: 1,
        roughness: 0.2,
        environment: "dusk",
      },
    };

    expect(serializeConfiguration(config)).toBe(
      "?v=1&c=oracle-frame&h=halo-head&a=void-weave&lw=drone-rack&rw=rail-lance&r=field-relay&p=a0b1c2&s=00ff7f&m=1&rf=0.2&e=dusk",
    );
  });

  it("round-trips every valid catalog selection across all finish boundaries", () => {
    let cases = 0;
    for (const chassis of catalog.chassis) {
      for (const head of catalog.heads) {
        for (const armor of catalog.armors) {
            for (const leftWeapon of catalog.weapons) {
              for (const rightWeapon of catalog.weapons) {
                if (!leftWeapon.slots.some((slot) => slot === "leftWeapon")) {
                  continue;
                }
                if (!rightWeapon.slots.some((slot) => slot === "rightWeapon")) {
                  continue;
                }
                for (const rearModule of catalog.rearModules) {
                for (const metalness of [0, 0.5, 1] as const) {
                  for (const roughness of [0.2, 0.6, 1] as const) {
                    for (const environment of [
                      "foundry",
                      "hangar",
                      "dusk",
                    ] as const) {
                      const config: MechConfiguration = {
                        version: 1,
                        chassisId: chassis.id,
                        headId: head.id,
                        armorId: armor.id,
                        leftWeaponId:
                          leftWeapon.id as MechConfiguration["leftWeaponId"],
                        rightWeaponId:
                          rightWeapon.id as MechConfiguration["rightWeaponId"],
                        rearModuleId: rearModule.id,
                        finish: {
                          primary: "#000000",
                          secondary: "#ffffff",
                          metalness,
                          roughness,
                          environment,
                        },
                      };
                      if (!validateConfiguration(config, catalog).ok) continue;

                      expect(
                        parseConfiguration(serializeConfiguration(config)),
                      ).toEqual({ ok: true, config, issues: [] });
                      cases += 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(cases).toBe(10_503);
  });

  it("fills omitted values from the approved default", () => {
    expect(parseConfiguration("?v=1&c=oracle-frame&h=halo-head")).toEqual({
      ok: true,
      config: {
        ...defaultConfiguration,
        chassisId: "oracle-frame",
        headId: "halo-head",
      },
      issues: [],
    });
  });

  it("normalizes illegal catalog, slot, chassis and weight values with stable issues", () => {
    const search =
      "?v=1&c=strider-scout&h=not-a-head&a=reactive-bastion&lw=rail-lance&rw=aegis-shield&r=siege-reactor";
    const first = parseConfiguration(search);
    const second = parseConfiguration(search);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.config).toEqual({
      ...defaultConfiguration,
      rightWeaponId: "arc-blade",
    });
    expect(first.issues.map(({ field, code }) => ({ field, code }))).toEqual([
      { field: "headId", code: "unknown-option" },
      { field: "armorId", code: "chassis-incompatible" },
      { field: "leftWeaponId", code: "slot-incompatible" },
      { field: "rightWeaponId", code: "slot-incompatible" },
      { field: "weight", code: "weight-limit" },
    ]);
  });

  it("handles missing, unsupported, malformed and duplicate versioned values deterministically", () => {
    expect(parseConfiguration("?c=oracle-frame")).toMatchObject({
      ok: false,
      config: defaultConfiguration,
      issues: [{ field: "version", code: "missing-version" }],
    });
    expect(parseConfiguration("?v=2&c=oracle-frame")).toMatchObject({
      ok: false,
      config: defaultConfiguration,
      issues: [{ field: "version", code: "unsupported-version", value: "2" }],
    });
    expect(parseConfiguration("?v=one&c=oracle-frame")).toMatchObject({
      ok: false,
      config: defaultConfiguration,
      issues: [{ field: "version", code: "malformed-value", value: "one" }],
    });
    expect(
      parseConfiguration(
        "?v=1&v=2&c=oracle-frame&c=bastion-hauler&m=Infinity&rf=NaN",
      ),
    ).toMatchObject({
      ok: true,
      config: {
        ...defaultConfiguration,
        chassisId: "oracle-frame",
      },
      issues: [
        { field: "version", code: "duplicate-key", value: "2" },
        { field: "chassisId", code: "duplicate-key", value: "bastion-hauler" },
        { field: "finish.metalness", code: "invalid-finish" },
        { field: "finish.roughness", code: "invalid-finish" },
      ],
    });
  });

  it("treats chassis-, part- and finish-only queries as incomplete shares", () => {
    for (const search of [
      "?c=oracle-frame",
      "?h=halo-head",
      "?p=ffffff",
      "?e=dusk",
    ]) {
      expect(parseConfiguration(search), search).toEqual({
        ok: false,
        config: defaultConfiguration,
        issues: [{ field: "version", code: "missing-version" }],
      });
    }
  });

  it("treats malicious query text as inert data and returns only a legal configuration", () => {
    const payload = "<img src=x onerror=globalThis.__pwned=1>";
    const result = parseConfiguration(
      `?v=1&c=${encodeURIComponent(payload)}&p=${encodeURIComponent(payload)}`,
    );

    expect(result.ok).toBe(true);
    expect(result.config).toEqual(defaultConfiguration);
    expect(result.issues).toContainEqual({
      field: "chassisId",
      code: "unknown-option",
      value: payload,
    });
    expect(result.issues).toContainEqual({
      field: "finish.primary",
      code: "invalid-finish",
      value: `#${payload}`,
    });
    expect(validateConfiguration(result.config, catalog)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("rejects invalid configurations instead of serializing them", () => {
    expect(() =>
      serializeConfiguration({
        ...defaultConfiguration,
        leftWeaponId: "rail-lance",
      } as unknown as MechConfiguration),
    ).toThrow(/合法配置/);
  });
});
