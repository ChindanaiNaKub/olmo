import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// @effect-diagnostics-next-line asyncFunction:off -- e2e test bodies are async by contract.
test("a visitor enters the world and sees the sandbox", async ({
  app,
  screen,
}) => {
  await app.open("/w/lobby");

  await screen.getByRole("textbox", "Your name").fill("Ada");
  await screen.getByRole("button", "Enter world").click();

  await expect(screen.getByRole("button", "Select Dirt")).toBeVisible();
  await expect(screen.getByText("Enter to chat")).toBeVisible();
  await expect(screen.getByText("offline")).toBeVisible();
  await expect(
    screen.getByText("Could not reach the game server")
  ).toBeVisible();
});
