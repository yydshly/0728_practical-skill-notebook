import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoDialog } from "../../src/components/ui/InfoDialog";
import { ShowcaseHud } from "../../src/components/ui/ShowcaseHud";
import { useShowcaseStore } from "../../src/state/useShowcaseStore";

beforeEach(() => {
  useShowcaseStore.setState(useShowcaseStore.getInitialState(), true);
});

test("marks the active camera choice as pressed", async () => {
  const user = userEvent.setup();

  render(<ShowcaseHud />);
  await user.click(screen.getByRole("button", { name: "案例" }));

  expect(screen.getByRole("button", { name: "案例" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("exposes required labels and preserves the active camera across capability changes", async () => {
  const user = userEvent.setup();

  render(<ShowcaseHud />);

  expect(
    screen.getByRole("region", { name: "能力展品" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "概览" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "交互" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "案例" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "保存当前画面" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "了解本次探索" }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "案例" }));
  await user.click(screen.getByRole("button", { name: /互动活动/ }));

  expect(
    screen.getByRole("button", { name: /互动活动/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "案例" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("enables capture only when both renderer and interactive canvas are available", () => {
  const { rerender } = render(<ShowcaseHud />);
  const captureButton = screen.getByRole("button", {
    name: "保存当前画面",
  });

  expect(captureButton).toBeDisabled();

  act(() => {
    useShowcaseStore.setState({
      renderer: {
        domElement: {
          toDataURL: () => "data:image/png;base64,",
        },
      },
    });
  });
  expect(captureButton).toBeEnabled();

  rerender(<ShowcaseHud canvasAvailable={false} />);

  expect(captureButton).toBeDisabled();
});

test("contains dialog focus and restores it to the exploration trigger", async () => {
  const user = userEvent.setup();

  render(
    <>
      <ShowcaseHud />
      <InfoDialog />
    </>,
  );
  const trigger = screen.getByRole("button", { name: "了解本次探索" });
  await user.click(trigger);

  const dialog = screen.getByRole("dialog", {
    name: "从空间叙事到业务成果",
  });
  expect(dialog).toHaveTextContent("这是一个独立实验");
  expect(dialog).toHaveTextContent("Fungarium");
  expect(dialog).toHaveTextContent("交互架构");

  const closeButton = screen.getByRole("button", { name: "关闭介绍" });
  expect(closeButton).toHaveFocus();
  await user.tab();
  expect(closeButton).toHaveFocus();
  await user.tab({ shift: true });
  expect(closeButton).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
