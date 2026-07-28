import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShowcaseHud } from "../../src/components/ui/ShowcaseHud";

test("marks the active camera choice as pressed", async () => {
  const user = userEvent.setup();

  render(<ShowcaseHud />);
  await user.click(screen.getByRole("button", { name: "案例" }));

  expect(screen.getByRole("button", { name: "案例" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
