# Finesse Evidence Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Chinese Finesse research exhibition that lets product, design, and engineering leads trace upstream-defined capabilities through project analysis into one SaaS product-expansion scenario.

**Architecture:** Create a standalone Vite/React/TypeScript single-page app inside `finesse-skill-product-research/`. Typed static content feeds four isolated feature areas—capability demos, analysis, scenario, and opportunities—through a shared research shell and evidence model; local UI state is shareable through URL parameters, while build-time validators reject unpinned or mislabeled content.

**Tech Stack:** Node.js 22+, Vite 7, React 19, TypeScript 5.9, CSS Modules, Vitest, Testing Library, Playwright, and `@axe-core/playwright`.

## Global Constraints

- Pin all upstream capability facts to commit `ba004b21e14e55385992dff6e345db7108deca78`, Skill `finesse-ui` version `0.12.0`, and MIT license.
- Do not install Finesse as a user-level Skill, copy upstream source/assets, call model APIs, fetch GitHub at runtime, or add a backend.
- Every capability claim must carry a source, limitation, and one of six exact statuses: `upstream-defined`, `interpretive-demo`, `project-verified`, `planned-validation`, `product-concept`, or `not-implemented`.
- The first release must not assign `project-verified` to any research claim.
- Every interpretive demo must visibly state that it is independently built by this project, is not an upstream page, and is not a completed controlled experiment.
- Use the same fictional SaaS product `Nova` and feature `Release Guard` across brand, product, and commerce demos.
- Preserve the confirmed `三幕引导式叙事`: original Skill capability demos → project analysis → expanded SaaS product scenario, followed by the opportunity map.
- Keep the exhibition shell editorial and restrained; isolate each register demo's visual grammar with CSS Modules.
- Core content and navigation must remain usable with JavaScript-driven animation disabled and under `prefers-reduced-motion`.
- Do not stage or modify the existing untracked root `.superpowers/` and `test-results/` directories.
- Read the confirmed design before starting: `docs/superpowers/specs/2026-07-30-finesse-evidence-atlas-design.md`.
- Run `npm`, Vite, Vitest, and Playwright commands with working directory `finesse-skill-product-research/`; run repository `git add`, `git status`, and `git commit` commands from the repository root.

## File Map

### Project configuration

- Create `finesse-skill-product-research/package.json` for local scripts and pinned dependency ranges.
- Create `finesse-skill-product-research/package-lock.json` through `npm install`.
- Create `finesse-skill-product-research/.gitignore` for dependencies, builds, and browser-test output.
- Create `finesse-skill-product-research/index.html` as the Vite document entry.
- Create `finesse-skill-product-research/tsconfig.json` for strict TypeScript and test sources.
- Create `finesse-skill-product-research/vite.config.ts` for React and a deterministic local port.
- Create `finesse-skill-product-research/vitest.config.ts` for jsdom unit/component tests.
- Create `finesse-skill-product-research/playwright.config.ts` for single-worker browser tests.
- Create `finesse-skill-product-research/scripts/validate-content.ts` as the build-blocking content validator.
- Create `finesse-skill-product-research/scripts/check-docs.mjs` for repository documentation claims and links.

### Application foundation

- Create `finesse-skill-product-research/src/main.tsx` as the React mount point.
- Create `finesse-skill-product-research/src/App.tsx` as the composition root.
- Create `finesse-skill-product-research/src/test/setup.ts` for jest-dom cleanup.
- Create `finesse-skill-product-research/src/styles/tokens.css` for the editorial color, type, spacing, and focus tokens.
- Create `finesse-skill-product-research/src/styles/global.css` for reset, document layout, reduced motion, and utility classes.
- Create `finesse-skill-product-research/src/content/types.ts` for all cross-feature content contracts.
- Create `finesse-skill-product-research/src/content/researchMeta.ts` for version, license, scope, and disclaimer.
- Create `finesse-skill-product-research/src/content/statusModel.ts` for the six status definitions.
- Create `finesse-skill-product-research/src/content/sources.ts` for pinned source records.
- Create `finesse-skill-product-research/src/content/demoDefinitions.ts` for register evidence and demo copy.
- Create `finesse-skill-product-research/src/content/analysisTrace.ts` for the frozen brief and analysis steps.
- Create `finesse-skill-product-research/src/content/scenario.ts` for the end-to-end SaaS scenario.
- Create `finesse-skill-product-research/src/content/opportunities.ts` for six product opportunity cards.
- Create `finesse-skill-product-research/src/content/index.ts` to expose one `researchContent` object.
- Create `finesse-skill-product-research/src/content/validateContent.ts` for pure validation functions.
- Create `finesse-skill-product-research/src/lib/urlState.ts` for parsing and writing shareable UI state.
- Create `finesse-skill-product-research/src/lib/downloadFile.ts` for deterministic client-side downloads.

### Feature modules

- Create `finesse-skill-product-research/src/features/shell/ResearchShell.tsx` for the global frame.
- Create `finesse-skill-product-research/src/features/shell/SectionNav.tsx` for four section links and progress.
- Create `finesse-skill-product-research/src/features/shell/StatusLegend.tsx` for six truthful status definitions.
- Create `finesse-skill-product-research/src/features/shell/ResearchShell.module.css` for responsive shell layout.
- Create `finesse-skill-product-research/src/features/capabilities/CapabilityGallery.tsx` for register tabs and active demo.
- Create `finesse-skill-product-research/src/features/capabilities/EvidenceRail.tsx` for Design Read, dials, sources, and limitations.
- Create `finesse-skill-product-research/src/features/capabilities/BrandDemo.tsx` and `BrandDemo.module.css`.
- Create `finesse-skill-product-research/src/features/capabilities/ProductDemo.tsx` and `ProductDemo.module.css`.
- Create `finesse-skill-product-research/src/features/capabilities/CommerceDemo.tsx` and `CommerceDemo.module.css`.
- Create `finesse-skill-product-research/src/features/capabilities/productModel.ts` for release filtering.
- Create `finesse-skill-product-research/src/features/capabilities/commerceModel.ts` for upgrade pricing.
- Create `finesse-skill-product-research/src/features/analysis/AnalysisStepper.tsx` for the eight-step reasoning trace.
- Create `finesse-skill-product-research/src/features/analysis/decisionPackage.ts` for JSON export.
- Create `finesse-skill-product-research/src/features/analysis/AnalysisStepper.module.css`.
- Create `finesse-skill-product-research/src/features/scenario/ScenarioJourney.tsx` for the guided scenario.
- Create `finesse-skill-product-research/src/features/scenario/AuditSummary.tsx` for separated evidence kinds.
- Create `finesse-skill-product-research/src/features/scenario/ScenarioJourney.module.css`.
- Create `finesse-skill-product-research/src/features/opportunities/OpportunityMap.tsx` for priority/status filters.
- Create `finesse-skill-product-research/src/features/opportunities/OpportunityMap.module.css`.

### Tests and documentation

- Create focused tests beside each feature as listed in its task.
- Create `finesse-skill-product-research/tests/browser/atlas.spec.ts` for the primary desktop path.
- Create `finesse-skill-product-research/tests/browser/accessibility.spec.ts` for keyboard, mobile, reduced-motion, and axe checks.
- Modify `finesse-skill-product-research/README.md` to document actual runnable scope and commands.
- Modify `finesse-skill-product-research/docs/SHOWCASE-PLAN.md` to add `本项目解释性演示` and rename `上游已实现` to `上游已定义`.
- Modify root `README.md` to replace the “currently not runnable” statement with an exact implemented/not-implemented inventory.

---

### Task 1: Establish the app and provenance contract

**Files:**
- Create: `finesse-skill-product-research/package.json`
- Create: `finesse-skill-product-research/package-lock.json`
- Create: `finesse-skill-product-research/.gitignore`
- Create: `finesse-skill-product-research/index.html`
- Create: `finesse-skill-product-research/tsconfig.json`
- Create: `finesse-skill-product-research/vite.config.ts`
- Create: `finesse-skill-product-research/vitest.config.ts`
- Create: `finesse-skill-product-research/src/main.tsx`
- Create: `finesse-skill-product-research/src/App.tsx`
- Create: `finesse-skill-product-research/src/test/setup.ts`
- Create: `finesse-skill-product-research/src/content/types.ts`
- Create: `finesse-skill-product-research/src/content/researchMeta.ts`
- Create: `finesse-skill-product-research/src/content/statusModel.ts`
- Create: `finesse-skill-product-research/src/content/validateContent.ts`
- Create: `finesse-skill-product-research/scripts/validate-content.ts`
- Test: `finesse-skill-product-research/src/content/validateContent.test.ts`
- Test: `finesse-skill-product-research/src/App.test.tsx`

**Interfaces:**
- Produces: `EvidenceStatusId`, `Register`, `ResearchMeta`, `StatusDefinition`, `SourceRef`, `DialSet`, `DemoDefinition`, `AnalysisTrace`, `ScenarioDefinition`, `Opportunity`, and `ResearchContent` from `src/content/types.ts`.
- Produces: `researchMeta: ResearchMeta` and `statusModel: readonly StatusDefinition[]`.
- Produces: `validateCoreContent(meta, statuses): string[]` and `assertCoreContent(meta, statuses): void`.

- [ ] **Step 1: Add the package and test/build configuration**

Create `package.json` with this exact script contract:

```json
{
  "name": "finesse-evidence-atlas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4188 --strictPort",
    "validate": "tsx scripts/validate-content.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "npm run validate && tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4188 --strictPort",
    "test:browser": "playwright test",
    "verify": "npm run test && npm run build && npm run test:browser"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.2",
    "@playwright/test": "^1.62.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.0.4",
    "jsdom": "^29.1.1",
    "tsx": "^4.20.6",
    "typescript": "^5.9.0",
    "vite": "^7.1.7",
    "vitest": "^4.1.10"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom/vitest"]
  },
  "include": [
    "src",
    "scripts",
    "tests",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts"
  ]
}
```

Create `vite.config.ts` and `vitest.config.ts`:

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: "docs",
});
```

Using the existing `docs/` directory as `publicDir` makes the four research documents available in development and copies them into `dist/` without duplicating their source files.

```ts
// vitest.config.ts
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [...configDefaults.exclude, "tests/browser/**"],
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

Create `index.html` with `<html lang="zh-CN">`, a UTF-8 charset, responsive viewport, title `Finesse 证据图谱`, `<div id="root"></div>`, and `<script type="module" src="/src/main.tsx"></script>`.

Create `.gitignore`:

```gitignore
node_modules/
dist/
test-results/
playwright-report/
```

Run:

```powershell
Set-Location finesse-skill-product-research
npm install
```

Expected: exit `0` and a new `package-lock.json`.

- [ ] **Step 2: Write failing provenance and mount tests**

Create `src/content/validateContent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { researchMeta } from "./researchMeta";
import { statusModel } from "./statusModel";
import { validateCoreContent } from "./validateContent";

describe("core research content", () => {
  it("pins the audited upstream version and defines six statuses", () => {
    expect(researchMeta.commit).toBe(
      "ba004b21e14e55385992dff6e345db7108deca78",
    );
    expect(researchMeta.version).toBe("0.12.0");
    expect(researchMeta.license).toBe("MIT");
    expect(statusModel).toHaveLength(6);
    expect(validateCoreContent(researchMeta, statusModel)).toEqual([]);
  });

  it("rejects a duplicate status and an unpinned commit", () => {
    const errors = validateCoreContent(
      { ...researchMeta, commit: "main" },
      [...statusModel, statusModel[0]!],
    );
    expect(errors).toContain("research commit must be the pinned 40-character SHA");
    expect(errors).toContain("status ids must be unique");
  });
});
```

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("identifies the atlas, pinned version, and truth boundary", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Finesse 证据图谱" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0\.12\.0/)).toBeInTheDocument();
    expect(screen.getByText(/独立研究与解释性演示/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```powershell
npm test -- --run src/content/validateContent.test.ts src/App.test.tsx
```

Expected: FAIL because `App`, `researchMeta`, `statusModel`, and validation functions do not exist.

- [ ] **Step 4: Implement the types, core content, validator, and minimal mount**

Define the shared status contract in `src/content/types.ts`:

```ts
export type EvidenceStatusId =
  | "upstream-defined"
  | "interpretive-demo"
  | "project-verified"
  | "planned-validation"
  | "product-concept"
  | "not-implemented";

export type Register = "brand" | "product" | "commerce";
export type Priority = "P0" | "P1" | "P2";

export interface ResearchMeta {
  name: string;
  upstreamRepo: string;
  commit: string;
  skill: string;
  version: string;
  license: "MIT";
  disclaimer: string;
}

export interface StatusDefinition {
  id: EvidenceStatusId;
  label: string;
  meaning: string;
  allowedInFirstRelease: boolean;
}

export interface SourceRef {
  id: string;
  label: string;
  url: string;
  kind: "upstream" | "project";
  pinned: boolean;
}

export interface DialSet {
  soul: number;
  spectacle: number;
  density: number;
}

export interface DemoDefinition {
  id: Register;
  title: string;
  task: string;
  designRead: string;
  dials: DialSet;
  sourceIds: readonly string[];
  limitations: readonly string[];
  status: "interpretive-demo";
  disclaimer: string;
}

export interface AnalysisStep {
  id: string;
  label: string;
  summary: string;
  sourceIds: readonly string[];
  status: EvidenceStatusId;
}

export interface AnalysisSurface {
  id: string;
  register: Register;
  job: string;
  rationale: string;
  demoId: Register;
  sourceIds: readonly string[];
}

export interface AnalysisTrace {
  brief: string;
  steps: readonly AnalysisStep[];
  surfaces: readonly AnalysisSurface[];
}

export type EvidenceKind =
  | "upstream-rule"
  | "static-demo"
  | "browser-test"
  | "planned-experiment"
  | "human-judgment";

export interface ScenarioEvidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  status: EvidenceStatusId;
  summary: string;
  sourceIds: readonly string[];
  details?: readonly string[];
}

export interface ScenarioStep {
  id: string;
  label: string;
  summary: string;
  evidenceIds: readonly string[];
}

export interface ScenarioDefinition {
  title: string;
  steps: readonly ScenarioStep[];
  evidence: readonly ScenarioEvidence[];
  judgement: readonly string[];
}

export interface Opportunity {
  id: string;
  name: string;
  priority: Priority;
  status: "product-concept";
  users: string;
  useCase: string;
  inheritedCapabilities: readonly string[];
  addedCapabilities: readonly string[];
  minimumLoop: string;
  risk: string;
  value: "中" | "高" | "很高";
  cost: "中" | "较高" | "高";
  dependencies: readonly string[];
}

export interface ResearchContent {
  meta: ResearchMeta;
  statuses: readonly StatusDefinition[];
  sources: readonly SourceRef[];
  demos: readonly DemoDefinition[];
  analysis: AnalysisTrace;
  scenario: ScenarioDefinition;
  opportunities: readonly Opportunity[];
}
```

Create `researchMeta` with the exact commit/version/license and this disclaimer:

```ts
export const researchMeta: ResearchMeta = {
  name: "Finesse 证据图谱",
  upstreamRepo: "https://github.com/mouse-lin/finesse-skill",
  commit: "ba004b21e14e55385992dff6e345db7108deca78",
  skill: "finesse-ui",
  version: "0.12.0",
  license: "MIT",
  disclaimer:
    "本项目是独立研究与解释性演示，不是上游官方版本、原始页面或已完成的受控实验。",
};
```

Create six `statusModel` records:

```ts
export const statusModel: readonly StatusDefinition[] = [
  {
    id: "upstream-defined",
    label: "上游已定义",
    meaning: "固定上游提交明确写出了该机制。",
    allowedInFirstRelease: true,
  },
  {
    id: "interpretive-demo",
    label: "本项目解释性演示",
    meaning: "本项目依据固定规则独立制作了可操作示例。",
    allowedInFirstRelease: true,
  },
  {
    id: "project-verified",
    label: "本项目已验证",
    meaning: "已按冻结输入、原始记录和浏览器证据完成验证。",
    allowedInFirstRelease: false,
  },
  {
    id: "planned-validation",
    label: "计划验证",
    meaning: "研究协议存在，但实验或运行时证据尚未完成。",
    allowedInFirstRelease: true,
  },
  {
    id: "product-concept",
    label: "产品构想",
    meaning: "基于能力与分析提出的产品机会。",
    allowedInFirstRelease: true,
  },
  {
    id: "not-implemented",
    label: "尚未实现",
    meaning: "规格中描述但首版没有接入的能力。",
    allowedInFirstRelease: true,
  },
] as const;
```

Implement validation as a pure error-list function:

```ts
const PINNED_COMMIT = "ba004b21e14e55385992dff6e345db7108deca78";

export function validateCoreContent(
  meta: ResearchMeta,
  statuses: readonly StatusDefinition[],
): string[] {
  const errors: string[] = [];
  if (meta.commit !== PINNED_COMMIT) {
    errors.push("research commit must be the pinned 40-character SHA");
  }
  if (meta.version !== "0.12.0") errors.push("skill version must be 0.12.0");
  if (meta.license !== "MIT") errors.push("upstream license must be MIT");
  if (statuses.length !== 6) errors.push("exactly six statuses are required");
  if (new Set(statuses.map((status) => status.id)).size !== statuses.length) {
    errors.push("status ids must be unique");
  }
  const verified = statuses.find((status) => status.id === "project-verified");
  if (!verified || verified.allowedInFirstRelease) {
    errors.push("project-verified must remain disabled in the first release");
  }
  return errors;
}

export function assertCoreContent(
  meta: ResearchMeta,
  statuses: readonly StatusDefinition[],
): void {
  const errors = validateCoreContent(meta, statuses);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
```

Make `scripts/validate-content.ts` call `assertCoreContent(researchMeta, statusModel)` and print the pinned version on success. Render the name, version, commit prefix, license, and disclaimer in `App.tsx`.

- [ ] **Step 5: Run tests, validation, and build to confirm GREEN**

Run:

```powershell
npm test -- --run src/content/validateContent.test.ts src/App.test.tsx
npm run validate
npm run build
```

Expected: both test files PASS, validation exits `0`, and Vite creates `dist/`.

- [ ] **Step 6: Commit the foundation**

```powershell
git add finesse-skill-product-research/package.json `
  finesse-skill-product-research/package-lock.json `
  finesse-skill-product-research/.gitignore `
  finesse-skill-product-research/index.html `
  finesse-skill-product-research/tsconfig.json `
  finesse-skill-product-research/vite.config.ts `
  finesse-skill-product-research/vitest.config.ts `
  finesse-skill-product-research/src `
  finesse-skill-product-research/scripts/validate-content.ts
git commit -m "feat: establish finesse evidence atlas"
```

### Task 2: Build the truthful narrative shell and URL state

**Files:**
- Create: `finesse-skill-product-research/src/styles/tokens.css`
- Create: `finesse-skill-product-research/src/styles/global.css`
- Create: `finesse-skill-product-research/src/lib/urlState.ts`
- Create: `finesse-skill-product-research/src/lib/urlState.test.ts`
- Create: `finesse-skill-product-research/src/features/shell/ResearchShell.tsx`
- Create: `finesse-skill-product-research/src/features/shell/ResearchShell.test.tsx`
- Create: `finesse-skill-product-research/src/features/shell/ResearchShell.module.css`
- Create: `finesse-skill-product-research/src/features/shell/SectionNav.tsx`
- Create: `finesse-skill-product-research/src/features/shell/StatusLegend.tsx`
- Modify: `finesse-skill-product-research/src/App.tsx`
- Modify: `finesse-skill-product-research/src/main.tsx`

**Interfaces:**
- Consumes: `researchMeta`, `statusModel`, `Register`, and `Priority` from Task 1.
- Produces: `SectionId`, `AtlasUrlState`, `parseAtlasUrl(url): AtlasUrlState`, and `writeAtlasUrl(url, patch): string`.
- Produces: `ResearchShell({ children })`, `SectionNav({ activeSection, onNavigate })`, and `StatusLegend({ statuses })`.

- [ ] **Step 1: Write failing URL-state and shell tests**

Create `src/lib/urlState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAtlasUrl, writeAtlasUrl } from "./urlState";

describe("atlas URL state", () => {
  it("parses valid shareable state", () => {
    const state = parseAtlasUrl(
      new URL(
        "https://example.test/?section=analysis&register=product&analysisStep=3&scenarioStep=2&priority=P0",
      ),
    );
    expect(state).toEqual({
      section: "analysis",
      register: "product",
      analysisStep: 3,
      scenarioStep: 2,
      priority: "P0",
      wasReset: false,
    });
  });

  it("replaces invalid values with safe defaults", () => {
    const state = parseAtlasUrl(
      new URL("https://example.test/?section=admin&register=unknown"),
    );
    expect(state.section).toBe("capabilities");
    expect(state.register).toBe("brand");
    expect(state.wasReset).toBe(true);
  });

  it("writes a patch without dropping other valid values", () => {
    const next = writeAtlasUrl(
      new URL("https://example.test/?section=capabilities&register=brand"),
      { section: "scenario", scenarioStep: 1 },
    );
    expect(next).toContain("section=scenario");
    expect(next).toContain("register=brand");
    expect(next).toContain("scenarioStep=1");
  });
});
```

Create `src/features/shell/ResearchShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { statusModel } from "../../content/statusModel";
import { ResearchShell } from "./ResearchShell";

describe("ResearchShell", () => {
  it("exposes four narrative sections, six statuses, and the scope warning", async () => {
    const onNavigate = vi.fn();
    render(
      <ResearchShell
        activeSection="capabilities"
        statuses={statusModel}
        onNavigate={onNavigate}
      >
        <p>内容</p>
      </ResearchShell>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    await userEvent.click(
      screen.getByRole("button", { name: "查看状态定义" }),
    );
    expect(screen.getByText("本项目解释性演示")).toBeInTheDocument();
    expect(screen.getByText(/不是上游官方版本/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npm test -- --run src/lib/urlState.test.ts src/features/shell/ResearchShell.test.tsx
```

Expected: FAIL because URL helpers and shell components do not exist.

- [ ] **Step 3: Implement the URL state contract**

Use these exact state values:

```ts
export type SectionId =
  | "capabilities"
  | "analysis"
  | "scenario"
  | "opportunities";

export interface AtlasUrlState {
  section: SectionId;
  register: Register;
  analysisStep: number;
  scenarioStep: number;
  priority: Priority | "all";
  wasReset: boolean;
}

export const DEFAULT_ATLAS_STATE: AtlasUrlState = {
  section: "capabilities",
  register: "brand",
  analysisStep: 0,
  scenarioStep: 0,
  priority: "all",
  wasReset: false,
};
```

`parseAtlasUrl` must clamp step values to non-negative integers and mark `wasReset: true` whenever a provided value is invalid. `writeAtlasUrl` must preserve valid existing state, apply the patch, and return `pathname + search + hash`.

- [ ] **Step 4: Implement the editorial shell**

Create CSS tokens for:

```css
:root {
  --atlas-paper: #ece9df;
  --atlas-paper-raised: #f6f3ea;
  --atlas-ink: #171814;
  --atlas-muted: #61645c;
  --atlas-line: #b9b6ac;
  --atlas-accent: #df4b2f;
  --status-upstream: #cde1cf;
  --status-demo: #cbdceb;
  --status-verified: #b9e0c2;
  --status-planned: #f4d9a9;
  --status-concept: #d9d1ef;
  --status-missing: #d7d5cf;
  --focus-ring: #1f63d3;
  --measure: 76rem;
}
```

`ResearchShell` must render:

- a skip link targeting `#main-content`;
- product name, `0.12.0`, commit prefix `ba004b2`, and MIT;
- a persistent sentence stating that this is independent research;
- four semantic navigation links;
- a button-controlled status legend using `aria-expanded`;
- a one-time `role="status"` reset message when URL state was invalid;
- `<main id="main-content">`.

`App.tsx` must render four real section landmarks with these headings and concise descriptions:

1. `原 Skill 能力演示`
2. `我们的分析演示`
3. `扩展产品场景`
4. `后续方向与使用场景`

Wire navigation through `history.pushState`, update the URL with `writeAtlasUrl`, and focus the destination heading after navigation.

- [ ] **Step 5: Run shell tests and the full unit suite**

Run:

```powershell
npm test -- --run src/lib/urlState.test.ts src/features/shell/ResearchShell.test.tsx
npm test
npm run build
```

Expected: focused and full suites PASS; build exits `0`.

- [ ] **Step 6: Commit the narrative shell**

```powershell
git add finesse-skill-product-research/src/App.tsx `
  finesse-skill-product-research/src/main.tsx `
  finesse-skill-product-research/src/styles `
  finesse-skill-product-research/src/lib/urlState.ts `
  finesse-skill-product-research/src/lib/urlState.test.ts `
  finesse-skill-product-research/src/features/shell
git commit -m "feat: add finesse atlas narrative shell"
```

### Task 3: Deliver the three register capability demos

**Files:**
- Create: `finesse-skill-product-research/src/content/sources.ts`
- Create: `finesse-skill-product-research/src/content/demoDefinitions.ts`
- Create: `finesse-skill-product-research/src/content/demoDefinitions.test.ts`
- Create: `finesse-skill-product-research/src/features/capabilities/CapabilityGallery.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/CapabilityGallery.test.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/EvidenceRail.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/BrandDemo.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/BrandDemo.module.css`
- Create: `finesse-skill-product-research/src/features/capabilities/ProductDemo.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/ProductDemo.module.css`
- Create: `finesse-skill-product-research/src/features/capabilities/CommerceDemo.tsx`
- Create: `finesse-skill-product-research/src/features/capabilities/CommerceDemo.module.css`
- Create: `finesse-skill-product-research/src/features/capabilities/productModel.ts`
- Create: `finesse-skill-product-research/src/features/capabilities/productModel.test.ts`
- Create: `finesse-skill-product-research/src/features/capabilities/commerceModel.ts`
- Create: `finesse-skill-product-research/src/features/capabilities/commerceModel.test.ts`
- Modify: `finesse-skill-product-research/src/App.tsx`

**Interfaces:**
- Consumes: `Register`, `DemoDefinition`, `SourceRef`, and URL state from Tasks 1–2.
- Produces: `sourceRefs: readonly SourceRef[]`, `demoDefinitions: readonly DemoDefinition[]`, and `DEMO_DISCLAIMER`.
- Produces: `filterReleases(records, filter): ReleaseRecord[]`.
- Produces: `calculateUpgrade(selection): UpgradeQuote`.
- Produces: `CapabilityGallery({ activeRegister, onRegisterChange })`.

- [ ] **Step 1: Write failing data and model tests**

Create `src/content/demoDefinitions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { demoDefinitions, DEMO_DISCLAIMER } from "./demoDefinitions";
import { sourceRefs } from "./sources";

describe("capability demo definitions", () => {
  it("defines one truthful demo per register", () => {
    expect(demoDefinitions.map((demo) => demo.id)).toEqual([
      "brand",
      "product",
      "commerce",
    ]);
    for (const demo of demoDefinitions) {
      expect(demo.status).toBe("interpretive-demo");
      expect(demo.disclaimer).toBe(DEMO_DISCLAIMER);
      expect(demo.sourceIds.length).toBeGreaterThan(0);
      expect(Object.values(demo.dials).every((value) => value >= 1 && value <= 10))
        .toBe(true);
    }
  });

  it("pins every upstream source to the audited commit", () => {
    const sha = "ba004b21e14e55385992dff6e345db7108deca78";
    for (const source of sourceRefs.filter((item) => item.kind === "upstream")) {
      expect(source.pinned).toBe(true);
      expect(source.url).toContain(sha);
    }
  });
});
```

Create `productModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterReleases, type ReleaseRecord } from "./productModel";

const records: ReleaseRecord[] = [
  { id: "rel-104", name: "API gateway", owner: "Lin", status: "blocked", risk: 82 },
  { id: "rel-105", name: "Web console", owner: "Maya", status: "ready", risk: 18 },
  { id: "rel-106", name: "Audit export", owner: "Noah", status: "reviewing", risk: 46 },
];

describe("filterReleases", () => {
  it("returns only matching statuses and preserves source order", () => {
    expect(filterReleases(records, "blocked").map((item) => item.id)).toEqual([
      "rel-104",
    ]);
    expect(filterReleases(records, "all")).toEqual(records);
  });
});
```

Create `commerceModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateUpgrade } from "./commerceModel";

describe("calculateUpgrade", () => {
  it("calculates an annual quote in integer cents", () => {
    expect(calculateUpgrade({ billing: "annual", seats: 12 })).toEqual({
      billing: "annual",
      seats: 12,
      unitPriceCents: 2400,
      recurringCents: 345600,
      cadenceLabel: "每年",
    });
  });

  it("clamps seats to the supported 1–500 range", () => {
    expect(calculateUpgrade({ billing: "monthly", seats: 0 }).seats).toBe(1);
    expect(calculateUpgrade({ billing: "monthly", seats: 900 }).seats).toBe(500);
  });
});
```

- [ ] **Step 2: Write the failing gallery interaction test**

Create `CapabilityGallery.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Register } from "../../content/types";
import { CapabilityGallery } from "./CapabilityGallery";

function Harness() {
  const [register, setRegister] = useState<Register>("brand");
  return (
    <CapabilityGallery
      activeRegister={register}
      onRegisterChange={setRegister}
    />
  );
}

describe("CapabilityGallery", () => {
  it("switches complete demos while keeping the truth boundary visible", async () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Release Guard 发布页" }))
      .toBeInTheDocument();
    expect(screen.getByText(/不是上游原始页面/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Product" }));
    expect(screen.getByRole("heading", { name: "发布运营工作台" }))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "仅看阻塞" }));
    const table = screen.getByRole("table", { name: "发布风险" });
    expect(within(table).getByText("API gateway")).toBeInTheDocument();
    expect(within(table).queryByText("Web console")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Commerce" }));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "席位数" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "席位数" }), "12");
    await userEvent.click(screen.getByRole("radio", { name: "年付" }));
    expect(screen.getByText("¥3,456 / 每年")).toBeInTheDocument();
    expect(screen.getByText(/演示模式，不会提交/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the capability tests and confirm RED**

Run:

```powershell
npm test -- --run src/content/demoDefinitions.test.ts `
  src/features/capabilities/productModel.test.ts `
  src/features/capabilities/commerceModel.test.ts `
  src/features/capabilities/CapabilityGallery.test.tsx
```

Expected: FAIL because the content, models, and components are missing.

- [ ] **Step 4: Implement pinned sources and three demo definitions**

Create these source IDs with pinned `blob` URLs:

```ts
const SHA = "ba004b21e14e55385992dff6e345db7108deca78";

export const sourceRefs: readonly SourceRef[] = [
  {
    id: "upstream-skill",
    label: "finesse-ui/SKILL.md",
    url: `https://github.com/mouse-lin/finesse-skill/blob/${SHA}/skills/finesse-ui/SKILL.md`,
    kind: "upstream",
    pinned: true,
  },
  {
    id: "upstream-preflight",
    label: "preflight.md",
    url: `https://github.com/mouse-lin/finesse-skill/blob/${SHA}/skills/finesse-ui/references/preflight.md`,
    kind: "upstream",
    pinned: true,
  },
  {
    id: "project-capability-map",
    label: "本项目能力地图",
    url: "./CAPABILITY-MAP.md",
    kind: "project",
    pinned: true,
  },
] as const;
```

Use this exact disclaimer:

```ts
export const DEMO_DISCLAIMER =
  "本页面由本项目依据固定版本规则独立制作，用于解释能力；它不是上游原始页面，也不是已完成的受控实验。";
```

Define the dial sets and core tasks:

```ts
export const demoDefinitions: readonly DemoDefinition[] = [
  {
    id: "brand",
    title: "Release Guard 发布页",
    task: "建立新功能认知并传达 Nova 的产品人格。",
    designRead: "brand / precise optimism / one non-bearing signal field",
    dials: { soul: 8, spectacle: 7, density: 3 },
    sourceIds: ["upstream-skill", "upstream-preflight", "project-capability-map"],
    limitations: ["不是需求研究", "不证明中端设备性能", "动效必须可降级"],
    status: "interpretive-demo",
    disclaimer: DEMO_DISCLAIMER,
  },
  {
    id: "product",
    title: "发布运营工作台",
    task: "读取发布风险并定位阻塞项。",
    designRead: "product / dashboard-read / dense operational evidence",
    dials: { soul: 5, spectacle: 2, density: 8 },
    sourceIds: ["upstream-skill", "upstream-preflight", "project-capability-map"],
    limitations: ["使用虚构数据", "不执行发布", "筛选不证明真实工作流"],
    status: "interpretive-demo",
    disclaimer: DEMO_DISCLAIMER,
  },
  {
    id: "commerce",
    title: "Release Guard Pro 升级",
    task: "比较方案、席位和升级后果。",
    designRead: "commerce / SaaS upgrade / trust before commitment",
    dials: { soul: 6, spectacle: 3, density: 7 },
    sourceIds: ["upstream-skill", "upstream-preflight", "project-capability-map"],
    limitations: ["没有真实支付", "价格为虚构内容", "不会提交套餐变更"],
    status: "interpretive-demo",
    disclaimer: DEMO_DISCLAIMER,
  },
] as const;
```

- [ ] **Step 5: Implement the Product and Commerce domain models**

Use exact unions and integer-cents calculation:

```ts
export type ReleaseStatus = "ready" | "reviewing" | "blocked";
export type ReleaseFilter = "all" | ReleaseStatus;

export interface ReleaseRecord {
  id: string;
  name: string;
  owner: string;
  status: ReleaseStatus;
  risk: number;
}

export function filterReleases(
  records: readonly ReleaseRecord[],
  filter: ReleaseFilter,
): ReleaseRecord[] {
  return filter === "all"
    ? [...records]
    : records.filter((record) => record.status === filter);
}
```

```ts
export type BillingCycle = "monthly" | "annual";

export interface UpgradeSelection {
  billing: BillingCycle;
  seats: number;
}

export interface UpgradeQuote extends UpgradeSelection {
  unitPriceCents: number;
  recurringCents: number;
  cadenceLabel: "每月" | "每年";
}

export function calculateUpgrade(selection: UpgradeSelection): UpgradeQuote {
  const seats = Math.min(500, Math.max(1, Math.trunc(selection.seats || 1)));
  const unitPriceCents = selection.billing === "annual" ? 2400 : 2900;
  const recurringCents =
    unitPriceCents * seats * (selection.billing === "annual" ? 12 : 1);
  return {
    billing: selection.billing,
    seats,
    unitPriceCents,
    recurringCents,
    cadenceLabel: selection.billing === "annual" ? "每年" : "每月",
  };
}
```

- [ ] **Step 6: Implement the gallery, evidence rail, and demos**

`CapabilityGallery` must use an ARIA tablist:

```tsx
const renderDemo = (register: Register) => {
  if (register === "brand") return <BrandDemo />;
  if (register === "product") return <ProductDemo />;
  return <CommerceDemo />;
};

export function CapabilityGallery({
  activeRegister,
  onRegisterChange,
}: {
  activeRegister: Register;
  onRegisterChange: (register: Register) => void;
}) {
  const definition = demoDefinitions.find(
    (demo) => demo.id === activeRegister,
  )!;
  return (
    <div>
      <div role="tablist" aria-label="Register 能力演示">
        {(["brand", "product", "commerce"] as const).map((register) => (
          <button
            key={register}
            role="tab"
            aria-selected={register === activeRegister}
            aria-controls={`demo-${register}`}
            onClick={() => onRegisterChange(register)}
          >
            {{ brand: "Brand", product: "Product", commerce: "Commerce" }[
              register
            ]}
          </button>
        ))}
      </div>
      <div id={`demo-${activeRegister}`} role="tabpanel">
        <div>{renderDemo(activeRegister)}</div>
        <EvidenceRail definition={definition} sources={sourceRefs} />
      </div>
    </div>
  );
}
```

Implement:

- Brand: semantic hero, the copy `Ship clarity. Not noise.`, the purpose statement `在风险抵达用户前看见它`, three disclosures named `风险信号`, `发布证据`, and `团队回放`, one decorative signal carrying `data-brand-signal`, and one CTA linking to the analysis section.
- Product: these four fixed records, four filter buttons (`全部`, `准备完成`, `评审中`, `仅看阻塞`), a semantic table, selectable detail row, and an explicit empty-filter message:

```ts
const releaseRecords: readonly ReleaseRecord[] = [
  { id: "rel-104", name: "API gateway", owner: "Lin", status: "blocked", risk: 82 },
  { id: "rel-105", name: "Web console", owner: "Maya", status: "ready", risk: 18 },
  { id: "rel-106", name: "Audit export", owner: "Noah", status: "reviewing", risk: 46 },
  { id: "rel-107", name: "CLI agent", owner: "Iris", status: "ready", risk: 24 },
] as const;
```

- Commerce: monthly/annual radio group, numeric seats input, three trust facts (`随时取消`, `变更前确认`, `不自动提交`), the formatted recurring total, and a button that opens a non-submitting confirmation message. Format integer cents with:

```ts
const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});
const totalLabel = `${currency.format(quote.recurringCents / 100)} / ${quote.cadenceLabel}`;
```

- EvidenceRail: `<meter min="1" max="10">` for each dial, source links, limitations list, the `interpretive-demo` label, and the full disclaimer.

Render EvidenceRail as `<details open>` with summary text `查看证据与限制`; Task 7 hides the summary and styles the open content as a side rail on desktop, then restores the collapsible summary below `48rem`.

Scope each demo with its own CSS Module. Use motion only in Brand; wrap all animation rules in:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Wire `activeRegister` to `AtlasUrlState.register` in `App.tsx`.

- [ ] **Step 7: Run the capability slice and full suite**

Run:

```powershell
npm test -- --run src/content/demoDefinitions.test.ts `
  src/features/capabilities/productModel.test.ts `
  src/features/capabilities/commerceModel.test.ts `
  src/features/capabilities/CapabilityGallery.test.tsx
npm test
npm run build
```

Expected: all focused tests and the full suite PASS; build exits `0`.

- [ ] **Step 8: Commit the capability gallery**

```powershell
git add finesse-skill-product-research/src/App.tsx `
  finesse-skill-product-research/src/content/sources.ts `
  finesse-skill-product-research/src/content/demoDefinitions.ts `
  finesse-skill-product-research/src/content/demoDefinitions.test.ts `
  finesse-skill-product-research/src/features/capabilities
git commit -m "feat: demonstrate three finesse registers"
```

### Task 4: Add the frozen-brief analysis and decision package

**Files:**
- Create: `finesse-skill-product-research/src/content/analysisTrace.ts`
- Create: `finesse-skill-product-research/src/content/analysisTrace.test.ts`
- Create: `finesse-skill-product-research/src/features/analysis/AnalysisStepper.tsx`
- Create: `finesse-skill-product-research/src/features/analysis/AnalysisStepper.test.tsx`
- Create: `finesse-skill-product-research/src/features/analysis/AnalysisStepper.module.css`
- Create: `finesse-skill-product-research/src/features/analysis/decisionPackage.ts`
- Create: `finesse-skill-product-research/src/features/analysis/decisionPackage.test.ts`
- Create: `finesse-skill-product-research/src/lib/downloadFile.ts`
- Modify: `finesse-skill-product-research/src/App.tsx`

**Interfaces:**
- Consumes: `AnalysisTrace`, `DemoDefinition`, `researchMeta`, `demoDefinitions`, and URL state.
- Produces: `analysisTrace: AnalysisTrace`.
- Produces: `DecisionPackage`, `buildDecisionPackage(trace, demos): DecisionPackage`, and `serializeDecisionPackage(value): string`.
- Produces: `AnalysisStepper({ activeStep, onStepChange, onExport })`.

- [ ] **Step 1: Write failing analysis-content and package tests**

Create `analysisTrace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analysisTrace } from "./analysisTrace";

describe("analysisTrace", () => {
  it("decomposes one frozen business brief into three page tasks", () => {
    expect(analysisTrace.steps).toHaveLength(8);
    expect(analysisTrace.surfaces.map((surface) => surface.register)).toEqual([
      "brand",
      "product",
      "commerce",
    ]);
    expect(analysisTrace.brief).toContain("Nova");
    expect(analysisTrace.brief).toContain("Release Guard");
  });
});
```

Create `decisionPackage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { demoDefinitions } from "../../content/demoDefinitions";
import { analysisTrace } from "../../content/analysisTrace";
import {
  buildDecisionPackage,
  serializeDecisionPackage,
} from "./decisionPackage";

describe("decision package", () => {
  it("exports pinned provenance and three surfaces without a verified claim", () => {
    const decisionPackage = buildDecisionPackage(
      analysisTrace,
      demoDefinitions,
    );
    expect(decisionPackage.schemaVersion).toBe(1);
    expect(decisionPackage.research.commit).toBe(
      "ba004b21e14e55385992dff6e345db7108deca78",
    );
    expect(decisionPackage.surfaces).toHaveLength(3);
    expect(decisionPackage.status).toBe("planned-validation");
    expect(serializeDecisionPackage(decisionPackage)).not.toContain(
      '"status": "project-verified"',
    );
  });
});
```

- [ ] **Step 2: Write the failing stepper test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisStepper } from "./AnalysisStepper";

describe("AnalysisStepper", () => {
  it("moves through the trace and exports only at the final step", async () => {
    const onStepChange = vi.fn();
    const onExport = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AnalysisStepper
        activeStep={0}
        onStepChange={onStepChange}
        onExport={onExport}
      />,
    );
    expect(screen.getByText(/Nova 将发布 Release Guard/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(onStepChange).toHaveBeenCalledWith(1);

    rerender(
      <AnalysisStepper
        activeStep={7}
        onStepChange={onStepChange}
        onExport={onExport}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "导出决策包" }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("keeps the analysis visible and reports a failed export", async () => {
    render(
      <AnalysisStepper
        activeStep={7}
        onStepChange={() => undefined}
        onExport={vi.fn().mockRejectedValue(new Error("download blocked"))}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "导出决策包" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "决策包生成失败，当前分析已保留，请重试。",
    );
    expect(screen.getByText("步骤 8 / 8")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run analysis tests and confirm RED**

Run:

```powershell
npm test -- --run src/content/analysisTrace.test.ts `
  src/features/analysis/decisionPackage.test.ts `
  src/features/analysis/AnalysisStepper.test.tsx
```

Expected: FAIL because the trace, package builder, and stepper are missing.

- [ ] **Step 4: Define the frozen brief and eight analysis steps**

Use this exact brief:

```ts
const brief =
  "Nova 将发布 Release Guard。团队需要建立新功能认知，让现有管理员查看发布风险，并允许组织评估升级方案。";
```

Create eight steps in this order:

1. `frozen-brief` — show the immutable brief and content version.
2. `audiences` — identify prospect, release owner, and organization admin.
3. `page-jobs` — split awareness, risk reading, and upgrade evaluation.
4. `registers` — map page jobs to brand, product, and commerce.
5. `dials` — show each demo's three dials and rationale.
6. `references` — list pinned Skill/preflight/capability-map sources.
7. `boundaries` — state that routing is not user research or experiment proof.
8. `package` — summarize the read-only decision package.

Assign `upstream-defined` only to rule descriptions, `interpretive-demo` to the three project surfaces, and `planned-validation` to conclusions requiring experiments.

- [ ] **Step 5: Implement deterministic decision-package export**

Use this package contract:

```ts
export interface DecisionPackage {
  schemaVersion: 1;
  generatedFrom: "finesse-evidence-atlas-static-content";
  research: {
    commit: string;
    skill: string;
    version: string;
  };
  brief: string;
  surfaces: readonly {
    id: string;
    register: Register;
    job: string;
    rationale: string;
    designRead: string;
    dials: DialSet;
    sourceIds: readonly string[];
  }[];
  status: "planned-validation";
  disclaimer: string;
}
```

`buildDecisionPackage` must join `analysisTrace.surfaces` to `demoDefinitions` by `demoId`, throw if a demo is missing, and copy the pinned metadata. `serializeDecisionPackage` must return `JSON.stringify(value, null, 2) + "\n"`.

Implement `downloadTextFile(filename, content, mimeType)` using a `Blob`, object URL, temporary anchor, and guaranteed `URL.revokeObjectURL` cleanup. Export the filename `nova-release-guard-decision-package.json`.

In `App.tsx`, pass an async export callback:

```ts
const exportDecisionPackage = async (): Promise<void> => {
  const value = buildDecisionPackage(analysisTrace, demoDefinitions);
  downloadTextFile(
    "nova-release-guard-decision-package.json",
    serializeDecisionPackage(value),
    "application/json;charset=utf-8",
  );
};
```

- [ ] **Step 6: Implement the accessible analysis stepper**

Use this prop contract:

```ts
interface AnalysisStepperProps {
  activeStep: number;
  onStepChange: (step: number) => void;
  onExport: () => Promise<void>;
}
```

The stepper must include:

- an ordered list of eight step buttons with `aria-current="step"`;
- visible step number, status label, summary, and source links;
- Previous/Next buttons with correct disabled states;
- a persistent statement that the business brief was decomposed into page tasks;
- an Export button only on step 8;
- a `role="status"` message after successful download.
- a `role="alert"` message `决策包生成失败，当前分析已保留，请重试。` when `onExport(): Promise<void>` rejects; the step and brief must remain mounted and the button must become available for another attempt.

Wire `activeStep` to `AtlasUrlState.analysisStep` and clamp it to `0–7`.

- [ ] **Step 7: Run analysis tests, full tests, and build**

Run:

```powershell
npm test -- --run src/content/analysisTrace.test.ts `
  src/features/analysis/decisionPackage.test.ts `
  src/features/analysis/AnalysisStepper.test.tsx
npm test
npm run build
```

Expected: all tests PASS and the production build succeeds.

- [ ] **Step 8: Commit the analysis flow**

```powershell
git add finesse-skill-product-research/src/App.tsx `
  finesse-skill-product-research/src/content/analysisTrace.ts `
  finesse-skill-product-research/src/content/analysisTrace.test.ts `
  finesse-skill-product-research/src/features/analysis `
  finesse-skill-product-research/src/lib/downloadFile.ts
git commit -m "feat: trace finesse brief decisions"
```

### Task 5: Add the SaaS decision-and-audit scenario

**Files:**
- Create: `finesse-skill-product-research/src/content/scenario.ts`
- Create: `finesse-skill-product-research/src/content/scenario.test.ts`
- Create: `finesse-skill-product-research/src/features/scenario/ScenarioJourney.tsx`
- Create: `finesse-skill-product-research/src/features/scenario/ScenarioJourney.test.tsx`
- Create: `finesse-skill-product-research/src/features/scenario/AuditSummary.tsx`
- Create: `finesse-skill-product-research/src/features/scenario/AuditSummary.test.ts`
- Create: `finesse-skill-product-research/src/features/scenario/ScenarioJourney.module.css`
- Modify: `finesse-skill-product-research/src/App.tsx`

**Interfaces:**
- Consumes: `ScenarioDefinition`, `EvidenceKind`, `EvidenceStatusId`, analysis content, and URL state.
- Produces: `scenario: ScenarioDefinition`.
- Produces: `groupEvidenceByKind(evidence): Record<EvidenceKind, ScenarioEvidence[]>`.
- Produces: `ScenarioJourney({ activeStep, onStepChange })` and `AuditSummary({ evidence })`.

- [ ] **Step 1: Write failing scenario-content tests**

Create `scenario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scenario } from "./scenario";

describe("scenario", () => {
  it("keeps five evidence kinds separate and never claims project verification", () => {
    expect(new Set(scenario.evidence.map((item) => item.kind))).toEqual(
      new Set([
        "upstream-rule",
        "static-demo",
        "browser-test",
        "planned-experiment",
        "human-judgment",
      ]),
    );
    expect(scenario.evidence.some((item) => item.status === "project-verified"))
      .toBe(false);
    expect(scenario.judgement).toContain(
      "Design Brief Router 作为入口，AI Design Review Console 作为审计核心。",
    );
  });
});
```

Create the grouping test beside `AuditSummary.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { scenario } from "../../content/scenario";
import { groupEvidenceByKind } from "./AuditSummary";

describe("groupEvidenceByKind", () => {
  it("returns all five keys without merging their authority", () => {
    const grouped = groupEvidenceByKind(scenario.evidence);
    expect(Object.keys(grouped)).toEqual([
      "upstream-rule",
      "static-demo",
      "browser-test",
      "planned-experiment",
      "human-judgment",
    ]);
    expect(grouped["planned-experiment"].at(0)?.status).toBe(
      "planned-validation",
    );
  });
});
```

- [ ] **Step 2: Write the failing journey test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScenarioJourney } from "./ScenarioJourney";

describe("ScenarioJourney", () => {
  it("shows the decision spine and preserves evidence boundaries", async () => {
    const onStepChange = vi.fn();
    const { rerender } = render(
      <ScenarioJourney activeStep={0} onStepChange={onStepChange} />,
    );
    expect(screen.getByRole("heading", { name: "冻结需求" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "继续到决策包" }));
    expect(onStepChange).toHaveBeenCalledWith(1);

    rerender(<ScenarioJourney activeStep={2} onStepChange={onStepChange} />);
    expect(screen.getByRole("heading", { name: "证据审计摘要" }))
      .toBeInTheDocument();
    expect(screen.getByText("静态示例信号")).toBeInTheDocument();
    expect(screen.getByText("尚未执行的受控实验")).toBeInTheDocument();
    expect(screen.queryByText("全部通过")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run scenario tests and confirm RED**

Run:

```powershell
npm test -- --run src/content/scenario.test.ts `
  src/features/scenario/AuditSummary.test.ts `
  src/features/scenario/ScenarioJourney.test.tsx
```

Expected: FAIL because scenario content and components do not exist.

- [ ] **Step 4: Define the four-step scenario and evidence records**

Use four steps:

1. `intake` / `冻结需求`
2. `decision-package` / `设计决策包`
3. `audit` / `证据审计摘要`
4. `judgement` / `产品判断与缺口`

Create at least one record for each evidence kind:

```ts
const evidence: readonly ScenarioEvidence[] = [
  {
    id: "ev-rule-register",
    kind: "upstream-rule",
    label: "register 路由规则",
    status: "upstream-defined",
    summary: "固定 Skill 按页面任务区分 brand、product 与 commerce。",
    sourceIds: ["upstream-skill"],
  },
  {
    id: "ev-demo-three-surfaces",
    kind: "static-demo",
    label: "三页面解释性实现",
    status: "interpretive-demo",
    summary: "本项目以同一 Nova 内容实现三种页面语法。",
    sourceIds: ["project-capability-map"],
  },
  {
    id: "ev-browser-atlas",
    kind: "browser-test",
    label: "展厅浏览器验证",
    status: "planned-validation",
    summary: "实现完成后记录桌面、移动端、键盘和减少动效结果。",
    sourceIds: [],
  },
  {
    id: "ev-experiment-b1-b5",
    kind: "planned-experiment",
    label: "B1–B5 受控研究",
    status: "planned-validation",
    summary: "受控实验和 A/B/C 对照尚未执行。",
    sourceIds: [],
  },
  {
    id: "ev-human-review",
    kind: "human-judgment",
    label: "人工设计判断",
    status: "planned-validation",
    summary: "审美与方向匹配仍需盲化评审和分歧记录。",
    sourceIds: [],
  },
];
```

Use this first judgement sentence exactly:

```ts
"Design Brief Router 作为入口，AI Design Review Console 作为审计核心。"
```

The remaining judgement sentences must say that this is opportunity ordering, not market validation, and that real evidence persistence is not implemented.

- [ ] **Step 5: Implement evidence grouping and the guided scenario**

`groupEvidenceByKind` must create keys in this stable order:

```ts
const EVIDENCE_KIND_ORDER: readonly EvidenceKind[] = [
  "upstream-rule",
  "static-demo",
  "browser-test",
  "planned-experiment",
  "human-judgment",
];
```

`AuditSummary` must render five independent sections and render an evidence record's `details` as a list when present. Do not calculate or display one aggregate score or pass/fail badge.

`ScenarioJourney` must:

- expose a four-step progress list with `aria-current`;
- use forward button labels `继续到决策包`, `继续到证据审计`, and `继续到产品判断`, plus a `返回上一步` action from steps 2–4;
- show evidence IDs and status text;
- link the decision-package step back to the three analysis surfaces;
- show explicit missing-evidence callouts in the audit step;
- show the product-spine recommendation and unresolved gaps in the final step;
- update `AtlasUrlState.scenarioStep`, clamped to `0–3`.

- [ ] **Step 6: Run scenario tests, full tests, and build**

Run:

```powershell
npm test -- --run src/content/scenario.test.ts `
  src/features/scenario/AuditSummary.test.ts `
  src/features/scenario/ScenarioJourney.test.tsx
npm test
npm run build
```

Expected: all tests PASS and the build succeeds.

- [ ] **Step 7: Commit the scenario**

```powershell
git add finesse-skill-product-research/src/App.tsx `
  finesse-skill-product-research/src/content/scenario.ts `
  finesse-skill-product-research/src/content/scenario.test.ts `
  finesse-skill-product-research/src/features/scenario
git commit -m "feat: demonstrate finesse product expansion"
```

### Task 6: Add the opportunity map and aggregate content gate

**Files:**
- Create: `finesse-skill-product-research/src/content/opportunities.ts`
- Create: `finesse-skill-product-research/src/content/opportunities.test.ts`
- Create: `finesse-skill-product-research/src/content/index.ts`
- Modify: `finesse-skill-product-research/src/content/validateContent.ts`
- Modify: `finesse-skill-product-research/src/content/validateContent.test.ts`
- Modify: `finesse-skill-product-research/scripts/validate-content.ts`
- Create: `finesse-skill-product-research/src/features/opportunities/OpportunityMap.tsx`
- Create: `finesse-skill-product-research/src/features/opportunities/OpportunityMap.test.tsx`
- Create: `finesse-skill-product-research/src/features/opportunities/OpportunityMap.module.css`
- Modify: `finesse-skill-product-research/src/App.tsx`

**Interfaces:**
- Consumes: all content contracts and feature section IDs.
- Produces: `opportunities: readonly Opportunity[]` and `researchContent: ResearchContent`.
- Produces: `validateResearchContent(content): string[]` and `assertResearchContent(content): void`.
- Produces: `OpportunityMap({ priority, onPriorityChange })`.

- [ ] **Step 1: Write failing opportunity and aggregate validation tests**

Create `opportunities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { opportunities } from "./opportunities";

describe("opportunities", () => {
  it("defines the six approved directions and two P0 spine modules", () => {
    expect(opportunities.map((item) => item.name)).toEqual([
      "Design Brief Router",
      "AI Design Review Console",
      "Design Model Studio",
      "Multi-Register Prototype Lab",
      "Pattern Knowledge Base",
      "Team Governance Layer",
    ]);
    expect(opportunities.filter((item) => item.priority === "P0").map(
      (item) => item.name,
    )).toEqual(["Design Brief Router", "AI Design Review Console"]);
    expect(opportunities.every((item) => item.status === "product-concept"))
      .toBe(true);
  });
});
```

Extend `validateContent.test.ts`:

```ts
import { researchContent } from "./index";
import { validateResearchContent } from "./validateContent";

it("accepts the complete first-release content graph", () => {
  expect(validateResearchContent(researchContent)).toEqual([]);
});

it("rejects missing source references and verified claims", () => {
  const broken = {
    ...researchContent,
    demos: [
      {
        ...researchContent.demos[0]!,
        sourceIds: ["missing-source"],
      },
      ...researchContent.demos.slice(1),
    ],
    scenario: {
      ...researchContent.scenario,
      evidence: [
        {
          ...researchContent.scenario.evidence[0]!,
          status: "project-verified" as const,
        },
        ...researchContent.scenario.evidence.slice(1),
      ],
    },
  };
  expect(validateResearchContent(broken)).toEqual(
    expect.arrayContaining([
      "unknown source id: missing-source",
      "project-verified is not allowed in the first release",
    ]),
  );
});
```

- [ ] **Step 2: Write the failing opportunity-map test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Priority } from "../../content/types";
import { OpportunityMap } from "./OpportunityMap";

function Harness() {
  const [priority, setPriority] = useState<Priority | "all">("all");
  return (
    <OpportunityMap
      priority={priority}
      onPriorityChange={setPriority}
    />
  );
}

describe("OpportunityMap", () => {
  it("filters to the two P0 modules and exposes their use cases", async () => {
    render(<Harness />);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "只看 P0" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Design Brief Router")).toBeInTheDocument();
    expect(screen.getByText("AI Design Review Console")).toBeInTheDocument();
    expect(screen.getAllByText("产品构想")).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run opportunity and validator tests and confirm RED**

Run:

```powershell
npm test -- --run src/content/opportunities.test.ts `
  src/content/validateContent.test.ts `
  src/features/opportunities/OpportunityMap.test.tsx
```

Expected: FAIL because opportunities, aggregate content, and the map do not exist.

- [ ] **Step 4: Define all six opportunity records**

Use IDs and priorities:

```ts
const opportunityIdentity = [
  ["brief-router", "Design Brief Router", "P0"],
  ["review-console", "AI Design Review Console", "P0"],
  ["design-model-studio", "Design Model Studio", "P1"],
  ["prototype-lab", "Multi-Register Prototype Lab", "P1"],
  ["pattern-knowledge-base", "Pattern Knowledge Base", "P2"],
  ["team-governance", "Team Governance Layer", "P2"],
] as const;
```

Populate every `Opportunity` field from `docs/PRODUCT-DIRECTIONS.md`. Use these dependency IDs:

- `brief-router`: none.
- `review-console`: `brief-router`.
- `design-model-studio`: `brief-router`.
- `prototype-lab`: `brief-router`, `review-console`.
- `pattern-knowledge-base`: `brief-router`.
- `team-governance`: `review-console`, `design-model-studio`.

All six records use `status: "product-concept"`. The cards must state a concrete user and use case; do not replace either with a generic team description.

- [ ] **Step 5: Implement the aggregate validator**

Create `researchContent`:

```ts
export const researchContent: ResearchContent = {
  meta: researchMeta,
  statuses: statusModel,
  sources: sourceRefs,
  demos: demoDefinitions,
  analysis: analysisTrace,
  scenario,
  opportunities,
};
```

`validateResearchContent` must:

1. Include all `validateCoreContent` errors.
2. Require upstream source URLs to contain the pinned commit.
3. Require exactly one demo for each register.
4. Require every dial to be an integer from 1 through 10.
5. Resolve every demo, analysis-step, analysis-surface, and scenario-evidence source ID.
6. Require exactly eight analysis steps and three analysis surfaces.
7. Require exactly four scenario steps and all five evidence kinds.
8. Require exactly six opportunities with unique IDs and exactly two P0 items.
9. Reject `project-verified` from demos, analysis steps, scenario evidence, and opportunities.
10. Require every interpretive demo to use `DEMO_DISCLAIMER`.

Use a helper that produces stable messages:

```ts
function validateSourceIds(
  ids: readonly string[],
  knownIds: ReadonlySet<string>,
): string[] {
  return ids
    .filter((id) => !knownIds.has(id))
    .map((id) => `unknown source id: ${id}`);
}
```

Update `scripts/validate-content.ts`:

```ts
import { researchContent } from "../src/content";
import { assertResearchContent } from "../src/content/validateContent";

assertResearchContent(researchContent);
console.log(
  `Validated ${researchContent.demos.length} demos, ` +
    `${researchContent.analysis.steps.length} analysis steps, ` +
    `${researchContent.opportunities.length} opportunities at ` +
    `${researchContent.meta.commit.slice(0, 8)}.`,
);
```

- [ ] **Step 6: Implement the opportunity map**

The map must render:

- filter buttons for `全部`, `P0`, `P1`, and `P2`;
- a visible `产品构想` status on every card;
- name, target users, use case, inherited/additional capabilities, minimum loop, risk, value, cost, priority, and dependencies;
- backlinks: P0 cards link to `#analysis` and `#scenario`; P1/P2 cards link to the most relevant earlier section;
- a text summary that explains P0 → P1 → P2 dependency order.

Use `AtlasUrlState.priority` for the active filter. An empty filtered result must show `当前筛选没有产品方向` and a `清除筛选` button.

- [ ] **Step 7: Run validators, tests, and build**

Run:

```powershell
npm test -- --run src/content/opportunities.test.ts `
  src/content/validateContent.test.ts `
  src/features/opportunities/OpportunityMap.test.tsx
npm run validate
npm test
npm run build
```

Expected: validator prints `3 demos`, `8 analysis steps`, and `6 opportunities`; all tests and build PASS.

- [ ] **Step 8: Commit opportunities and the content gate**

```powershell
git add finesse-skill-product-research/src/App.tsx `
  finesse-skill-product-research/src/content `
  finesse-skill-product-research/src/features/opportunities `
  finesse-skill-product-research/scripts/validate-content.ts
git commit -m "feat: map finesse product opportunities"
```

### Task 7: Prove responsive, keyboard, and browser behavior

**Files:**
- Create: `finesse-skill-product-research/playwright.config.ts`
- Create: `finesse-skill-product-research/tests/browser/atlas.spec.ts`
- Create: `finesse-skill-product-research/tests/browser/accessibility.spec.ts`
- Modify: `finesse-skill-product-research/src/styles/tokens.css`
- Modify: `finesse-skill-product-research/src/styles/global.css`
- Modify: `finesse-skill-product-research/src/features/shell/ResearchShell.module.css`
- Modify: `finesse-skill-product-research/src/features/capabilities/CapabilityGallery.tsx`
- Modify: `finesse-skill-product-research/src/features/capabilities/EvidenceRail.tsx`
- Modify: `finesse-skill-product-research/src/features/capabilities/CapabilityGallery.test.tsx`
- Modify: `finesse-skill-product-research/src/content/scenario.ts`
- Modify: `finesse-skill-product-research/src/content/scenario.test.ts`
- Modify: feature CSS Modules as required by the exact responsive rules below.

**Interfaces:**
- Consumes: the complete app from Tasks 1–6.
- Produces: a keyboard-complete tab contract and reproducible browser evidence under Playwright's ignored output directory.

- [ ] **Step 1: Configure isolated browser tests**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  outputDir: "./test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4188",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
  },
});
```

Confirm the project-local `.gitignore` created in Task 1 contains:

```gitignore
node_modules/
dist/
test-results/
playwright-report/
```

- [ ] **Step 2: Add a failing keyboard-tab component test**

Extend `CapabilityGallery.test.tsx`:

```tsx
it("moves register tabs with arrow keys", async () => {
  render(<Harness />);
  const brand = screen.getByRole("tab", { name: "Brand" });
  brand.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Product" })).toHaveFocus();
  expect(screen.getByRole("heading", { name: "发布运营工作台" }))
    .toBeInTheDocument();
  await userEvent.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Commerce" })).toHaveFocus();
});
```

Run:

```powershell
npm test -- --run src/features/capabilities/CapabilityGallery.test.tsx
```

Expected: FAIL because the tabs do not yet implement roving focus and arrow keys.

- [ ] **Step 3: Implement the complete tab keyboard contract**

In `CapabilityGallery`, keep refs for the three tabs and implement:

```ts
function nextRegister(
  current: Register,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
): Register {
  const order: readonly Register[] = ["brand", "product", "commerce"];
  if (key === "Home") return order[0]!;
  if (key === "End") return order[order.length - 1]!;
  const index = order.indexOf(current);
  const delta = key === "ArrowRight" ? 1 : -1;
  return order[(index + delta + order.length) % order.length]!;
}
```

On those four keys, prevent default, call `onRegisterChange(next)`, and focus the next tab. Set `tabIndex={register === activeRegister ? 0 : -1}`.

- [ ] **Step 4: Write the desktop journey browser test**

Create `tests/browser/atlas.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a lead can trace capabilities, analysis, scenario, and P0 opportunities", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?section=capabilities&register=brand");
  await expect(page.getByRole("heading", { name: "Finesse 证据图谱" }))
    .toBeVisible();
  await expect(page.getByText(/不是上游原始页面/)).toBeVisible();

  await page.getByRole("tab", { name: "Product" }).click();
  await page.getByRole("button", { name: "仅看阻塞" }).click();
  await expect(page.getByRole("table", { name: "发布风险" }))
    .toContainText("API gateway");

  await page.getByRole("tab", { name: "Commerce" }).click();
  await page.getByRole("spinbutton", { name: "席位数" }).fill("12");
  await page.getByRole("radio", { name: "年付" }).check();
  await expect(page.getByText("¥3,456 / 每年")).toBeVisible();

  await page.getByRole("link", { name: "我们的分析演示" }).click();
  await expect(page).toHaveURL(/section=analysis/);
  for (let step = 0; step < 7; step += 1) {
    await page.getByRole("button", { name: "下一步" }).click();
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出决策包" }).click();
  expect((await download).suggestedFilename()).toBe(
    "nova-release-guard-decision-package.json",
  );

  await page.getByRole("link", { name: "扩展产品场景" }).click();
  await page.getByRole("button", { name: "继续到决策包" }).click();
  await page.getByRole("button", { name: "继续到证据审计" }).click();
  await expect(page.getByText("尚未执行的受控实验")).toBeVisible();

  await page.getByRole("link", { name: "后续方向与使用场景" }).click();
  await page.getByRole("button", { name: "只看 P0" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(consoleErrors).toEqual([]);
});
```

- [ ] **Step 5: Write mobile, reduced-motion, deep-link, and axe tests**

Create `tests/browser/accessibility.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the primary page has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("mobile content has no horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?section=capabilities&register=product");
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await expect(page.getByRole("button", { name: "查看证据与限制" }))
    .toBeVisible();
});

test("deep links recover state and reduced motion disables long animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/?section=analysis&register=brand&analysisStep=5&scenarioStep=2&priority=P0",
  );
  await expect(page.getByRole("tab", { name: "Brand" }))
    .toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("步骤 6 / 8")).toBeVisible();
  const durations = await page.locator("[data-brand-signal]").evaluate((node) => {
    const style = getComputedStyle(node);
    const toMilliseconds = (value: string) =>
      value.endsWith("ms")
        ? Number.parseFloat(value)
        : Number.parseFloat(value) * 1000;
    return [
      toMilliseconds(style.animationDuration),
      toMilliseconds(style.transitionDuration),
    ];
  });
  expect(durations.every((duration) => duration <= 0.1)).toBe(true);
});
```

- [ ] **Step 6: Apply exact responsive and contrast rules**

Ensure:

- body text `#171814` on `#ece9df`;
- muted text no lighter than `#5b5e56` on `#ece9df`;
- focus ring `#1f63d3`, `3px` wide, with `2px` offset;
- minimum interactive target height `44px`;
- content width capped by `--measure`;
- desktop capability layout uses `minmax(0, 1fr) minmax(18rem, 24rem)`;
- under `48rem`, the evidence rail becomes a `<details>` block with summary `查看证据与限制`;
- Product tables use a horizontal wrapper local to the table rather than causing document overflow;
- Commerce plan controls stack under `40rem`;
- all non-essential transitions become `0.01ms` under reduced motion.

Add a unit assertion that the six status definitions have non-empty labels and meanings; use visible text beside every status color. Do not disable Axe color-contrast, landmark, naming, focus, or keyboard rules.

- [ ] **Step 7: Run browser proof and full verification**

Install the browser once if needed:

```powershell
npx playwright install chromium
```

Then run:

```powershell
npm test
npm run build
npm run test:browser
```

Expected: unit/component suite PASS, build succeeds, and all Playwright tests PASS with no serious/critical axe violations or console errors.

- [ ] **Step 8: Record the bounded browser evidence and test the claim**

Only after Step 7 passes, change the `ev-browser-atlas` record in `src/content/scenario.ts` to:

```ts
{
  id: "ev-browser-atlas",
  kind: "browser-test",
  label: "展厅浏览器验证",
  status: "interpretive-demo",
  summary:
    "当前展厅提交已通过 Chromium 桌面、移动端、键盘、深链接、下载与减少动效检查。",
  sourceIds: [],
  details: [
    "命令：npm run test:browser",
    "桌面视口：1440 × 900",
    "移动视口：390 × 844",
    "边界：只证明当前展厅构建，不证明 Finesse 的跨模型或跨项目效果",
  ],
}
```

Update `scenario.test.ts` to require `ev-browser-atlas.status === "interpretive-demo"` while still rejecting every `project-verified` claim. Run:

```powershell
npm test -- --run src/content/scenario.test.ts
npm run validate
npm run test:browser
```

Expected: focused test, aggregate content validation, and browser suite all PASS.

- [ ] **Step 9: Commit the verified responsive experience**

```powershell
git add finesse-skill-product-research/.gitignore `
  finesse-skill-product-research/playwright.config.ts `
  finesse-skill-product-research/tests/browser `
  finesse-skill-product-research/src/styles `
  finesse-skill-product-research/src/features `
  finesse-skill-product-research/src/content/scenario.ts `
  finesse-skill-product-research/src/content/scenario.test.ts
git commit -m "test: verify finesse atlas experience"
```

### Task 8: Synchronize truthful documentation and run the release gate

**Files:**
- Create: `finesse-skill-product-research/scripts/check-docs.mjs`
- Modify: `finesse-skill-product-research/package.json`
- Modify: `finesse-skill-product-research/README.md`
- Modify: `finesse-skill-product-research/docs/SHOWCASE-PLAN.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the verified app and the status taxonomy.
- Produces: `npm run check:docs` and a final `npm run verify` release gate.

- [ ] **Step 1: Write the failing documentation checker**

Create `scripts/check-docs.mjs`:

```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(projectRoot, "..");
const read = (path) => readFileSync(path, "utf8");
const projectReadme = read(resolve(projectRoot, "README.md"));
const showcasePlan = read(resolve(projectRoot, "docs", "SHOWCASE-PLAN.md"));
const rootReadme = read(resolve(repoRoot, "README.md"));

const failures = [];
const requireText = (name, text, fragment) => {
  if (!text.includes(fragment)) failures.push(`${name} missing: ${fragment}`);
};
const rejectText = (name, text, fragment) => {
  if (text.includes(fragment)) failures.push(`${name} still contains: ${fragment}`);
};

requireText("project README", projectReadme, "npm run dev");
requireText("project README", projectReadme, "本项目解释性演示");
requireText("project README", projectReadme, "受控实验尚未执行");
requireText("showcase plan", showcasePlan, "上游已定义");
requireText("showcase plan", showcasePlan, "本项目解释性演示");
rejectText("showcase plan", showcasePlan, "| 上游已实现 |");

const projectEightStart = rootReadme.indexOf("## 08 · Finesse Skill 产品研究");
const nextHeading = rootReadme.indexOf("\n## ", projectEightStart + 4);
const projectEight = rootReadme.slice(
  projectEightStart,
  nextHeading === -1 ? undefined : nextHeading,
);
requireText("root project 08", projectEight, "可运行研究展厅");
requireText("root project 08", projectEight, "不接入 AI 或后端");
rejectText("root project 08", projectEight, "当前不可运行");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Documentation claims match the implemented atlas boundary.");
```

Add the script and extend verification:

```json
{
  "scripts": {
    "check:docs": "node scripts/check-docs.mjs",
    "verify": "npm run test && npm run build && npm run test:browser && npm run check:docs"
  }
}
```

- [ ] **Step 2: Run the checker and confirm RED**

Run:

```powershell
npm run check:docs
```

Expected: FAIL because current documentation still says the exhibition is not runnable and lacks the new status.

- [ ] **Step 3: Update the project README with exact current scope**

Add:

- commands for `npm install`, `npm run dev`, `npm test`, `npm run build`, and `npm run test:browser`;
- a current feature list naming the three register demos, analysis trace, SaaS scenario, and opportunity map;
- the six-status model, including `本项目解释性演示`;
- a statement that the UI uses fixed repository data and does not call AI, GitHub, a backend, payment, or a real audit service;
- a statement that B1–B5 and A/B/C controlled experiments remain unexecuted;
- a source/license boundary and the full pinned commit.

Replace the previous sentence saying all exhibit code is unimplemented. Preserve links to all four research documents.

- [ ] **Step 4: Synchronize the showcase plan status and roadmap**

In `docs/SHOWCASE-PLAN.md`:

- rename the exact status row `上游已实现` to `上游已定义`;
- add `本项目解释性演示` with the meaning from the design spec;
- mark the narrative shell, three demos, analysis stepper, static scenario, and opportunity map as implemented exhibition modules;
- retain `计划验证` on B1–B5, A/B/C comparisons, runtime evidence beyond this app, and human review;
- retain `尚未实现` on AI generation, persistent audit records, accounts, permissions, CI, and team governance;
- replace the statement that no page or interaction exists with an exact first-release inventory.

Do not mark any research conclusion `本项目已验证`.

- [ ] **Step 5: Update the root project-08 entry**

Change the catalog summary and project-08 section to say:

- the local project now contains a runnable research exhibition;
- it demonstrates three independently built register examples;
- it traces one frozen brief into three page jobs;
- it demonstrates a static decision-and-audit scenario and six product directions;
- it uses fixed data and does not connect AI or a backend;
- controlled experiments and production services remain unimplemented.

Keep all existing project links and the fixed upstream boundary.

- [ ] **Step 6: Run the documentation checker and focused link checks**

Run:

```powershell
npm run check:docs
node -e "const fs=require('node:fs');for(const p of ['README.md','docs/CAPABILITY-MAP.md','docs/RESEARCH-PLAN.md','docs/PRODUCT-DIRECTIONS.md','docs/SHOWCASE-PLAN.md']){if(!fs.existsSync(p))throw new Error(p)};console.log('project docs present')"
```

Expected: documentation checker exits `0` and all five project Markdown files exist.

- [ ] **Step 7: Run the complete fresh release gate**

From `finesse-skill-product-research/`:

```powershell
npm ci
npm run verify
```

From the repository root:

```powershell
git diff --check
git status --short --untracked-files=no
```

Expected:

- `npm ci` exits `0`;
- all unit/component tests PASS;
- content validation and TypeScript/Vite build PASS;
- all Playwright tests PASS;
- documentation checker PASS;
- `git diff --check` prints nothing;
- tracked status lists only the intended Task 8 documentation/script/package changes before commit.

- [ ] **Step 8: Commit the truthful release documentation**

```powershell
git add README.md `
  finesse-skill-product-research/README.md `
  finesse-skill-product-research/docs/SHOWCASE-PLAN.md `
  finesse-skill-product-research/package.json `
  finesse-skill-product-research/scripts/check-docs.mjs
git commit -m "docs: publish finesse evidence atlas"
```

- [ ] **Step 9: Verify the committed result**

Run:

```powershell
git status --short --untracked-files=no
git log -8 --oneline
npm run verify
```

Expected: tracked status is clean, the eight task commits are visible in order, and the complete verification gate passes again on the committed state.
