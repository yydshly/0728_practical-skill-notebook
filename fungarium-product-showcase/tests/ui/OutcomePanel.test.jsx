import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutcomePanel } from "../../src/components/ui/OutcomePanel";
import { ShowcaseHud } from "../../src/components/ui/ShowcaseHud";

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
