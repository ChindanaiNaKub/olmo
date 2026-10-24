import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// @effect-diagnostics-next-line asyncFunction:off -- e2e test bodies are async by contract.
test("the name gate opens the lobby", async ({ app, screen }) => {
  await app.open("/w/lobby");

  await expect(screen.getByRole("heading", "Olmo")).toBeVisible();
  await expect(screen.getByRole("textbox", "Your name")).toBeVisible();
  await expect(screen.getByRole("button", "Enter world")).toBeVisible();
  await expect(screen.getByText("World /w/lobby")).toBeVisible();
});
