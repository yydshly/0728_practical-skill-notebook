import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutcomePanel } from "../../src/components/ui/OutcomePanel";
import { ShowcaseHud } from "../../src/components/ui/ShowcaseHud";
import { StaticFallback } from "../../src/components/ui/StaticFallback";
import { useShowcaseStore } from "../../src/state/useShowcaseStore";

beforeEach(() => {
  useShowcaseStore.setState(useShowcaseStore.getInitialState(), true);
});

test("updates the outcome panel after a capability selection", async () => {
  const user = userEvent.setup();

  render(
    <>
      <ShowcaseHud />
      <OutcomePanel />
    </>,
  );
  await user.click(screen.getByRole("button", { name: /互动活动/ }));

  expect(
    screen.getByRole("heading", { name: "让访客参与，而不只是观看" }),
  ).toBeVisible();
});

test("announces the selected outcome with complete evidence and one local case link", () => {
  render(<OutcomePanel />);

  const panel = screen.getByRole("article");
  expect(panel).toHaveAttribute("aria-live", "polite");
  expect(
    within(panel).getByRole("heading", {
      name: "让产品故事可以被亲手探索",
    }),
  ).toBeVisible();
  expect(
    within(panel).getByText("品牌官网、目的地介绍与高价值方案提案"),
  ).toBeVisible();
  expect(
    within(panel).getByText(
      "把复杂价值组织为可感知、可停留、可分享的体验。",
    ),
  ).toBeVisible();
  expect(
    within(panel).getByText(
      "雾岛灯塔：滚动驱动的 2.5D 场景与可操作的航线档案。",
    ),
  ).toBeVisible();

  const caseLinks = within(panel).getAllByRole("link", { name: "查看案例" });
  expect(caseLinks).toHaveLength(1);
  expect(caseLinks[0]).toHaveAttribute("href", "../isle-of-quiet-signals/");
});

test("renders every capability and local link in source order in the static fallback", () => {
  render(<StaticFallback reason="reduced-motion" />);

  expect(
    screen.getByText("已根据你的动态效果偏好，提供完整的静态浏览方式。"),
  ).toBeVisible();
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((heading) =>
      heading.textContent,
    ),
  ).toEqual([
    "让产品故事可以被亲手探索",
    "让访客参与，而不只是观看",
    "让决策在真实界面中发生",
  ]);
  expect(
    screen
      .getAllByRole("link", { name: "查看案例" })
      .map((link) => link.getAttribute("href")),
  ).toEqual([
    "../isle-of-quiet-signals/",
    "../world-cup-letter-flags-demo/",
    "../fabrica-template-detail-clone/",
  ]);
  expect(
    screen.getByText("品牌官网、目的地介绍与高价值方案提案"),
  ).toBeVisible();
  expect(
    screen.getByText("用即时反馈把品牌信息变成愿意停留和分享的参与时刻。"),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Fabrica Template Detail Clone：以本地 React 页面重建并验证完整模板详情体验。",
    ),
  ).toBeVisible();
});
