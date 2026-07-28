import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the client showroom landmark", () => {
  render(<App />);
  expect(
    screen.getByRole("main", { name: "产品能力展厅" }),
  ).toBeInTheDocument();
});
