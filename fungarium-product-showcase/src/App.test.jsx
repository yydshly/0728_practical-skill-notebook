import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the client showroom landmark", () => {
  render(<App />);
  expect(
    screen.getByRole("main", { name: "浜у搧鑳藉姏灞曞巺" }),
  ).toBeInTheDocument();
});
