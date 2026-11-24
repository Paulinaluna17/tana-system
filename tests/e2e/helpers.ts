import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByText("Equipo de Tana: entrar con contraseña").click();
  await page.fill("#email-pw", email);
  await page.fill("#password", "tana1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
