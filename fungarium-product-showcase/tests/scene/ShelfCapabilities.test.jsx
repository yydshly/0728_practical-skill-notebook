import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CAPABILITIES } from "../../src/config/showcaseConfig";
import { ShelfCapabilities } from "../../src/components/scene/ShelfCapabilities";
import { useShowcaseStore } from "../../src/state/useShowcaseStore";

vi.mock("@react-three/drei", () => ({
  Html: ({ children }) => <>{children}</>,
}));

vi.mock("../../src/components/scene/CapabilityArtifact", () => ({
  CapabilityArtifact: () => null,
}));

beforeEach(() => {
  useShowcaseStore.setState(useShowcaseStore.getInitialState(), true);
});

test("uses a Chinese screen reader label for shelf capability controls", () => {
  render(<ShelfCapabilities />);

  expect(
    screen.getByRole("button", {
      name: `选择${CAPABILITIES[1].railLabel}`,
    }),
  ).toBeInTheDocument();
});
