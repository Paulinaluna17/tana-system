import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";

test("Tana ve los dos clientes con sus alertas", async ({ page }) => {
  await login(page, "socia1@tana.studio");
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByRole("link", { name: "Roma · Centro de Entrenamiento", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Las Popas" }).first()).toBeVisible();
  await expect(page.getByText("Vencido").first()).toBeVisible();
});

test("calendario de noviembre: días correctos, tachado, hoy y atrasada", async ({ page }) => {
  await login(page, "socia1@tana.studio");
  await page.goto("/clientes/las-popas/calendario?y=2026&m=11");
  await page.getByRole("tab", { name: "Mes" }).click();
  // El 2/11/2026 es lunes: primera columna de la segunda fila.
  await expect(page.getByLabel("Lunes 2 de noviembre", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Martes 31 de noviembre", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Atrasada").first()).toBeVisible();
  await expect(page.getByText("Hoy", { exact: true }).first()).toBeVisible();
});

test("cliente pide cambios → Tana edita → cliente ve el cambio y aprueba", async ({ page }) => {
  await login(page, "laspopas@ejemplo.com");
  await expect(page).toHaveURL(/\/portal\/las-popas/);
  await expect(page.getByText("Pendiente de vos")).toBeVisible();
  await page.getByRole("link", { name: /De la foto al cuerpo/ }).first().click();
  await expect(page.getByText("Notas internas")).toHaveCount(0);
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await page.getByLabel("Cambios que querés").fill("Usemos el vestido azul como prenda principal.");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expectToast(page, "Tana ya recibió tu pedido");
  const pieceUrl = page.url();

  await login(page, "socia1@tana.studio");
  await page.goto("/notificaciones");
  await expect(page.getByText("El cliente pidió cambios").first()).toBeVisible();
  await page.goto(pieceUrl.replace(/\/portal\/las-popas\//, "/clientes/las-popas/"));
  await expect(page.getByText("Usemos el vestido azul").first()).toBeVisible();
  await page.getByLabel("Tema / idea").fill("De la foto al cuerpo · vestido azul");
  await page.getByLabel("Estado").selectOption("para_revisar");
  await page.getByRole("button", { name: "Guardar" }).first().click();
  await expectToast(page, "Guardado");

  await login(page, "laspopas@ejemplo.com");
  await page.goto(pieceUrl);
  await expect(page.getByText("Actualizado").first()).toBeVisible();
  await expect(page.getByText("De la foto al cuerpo · vestido azul").first()).toBeVisible();
  await expect(page.getByText("Qué cambió")).toBeVisible();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expectToast(page, "¡Aprobada!");
  await expect(page.getByText(/Aprobado por Las Popas/)).toBeVisible();
});

test("cliente informa un pago con comprobante y Tana lo confirma", async ({ page }) => {
  await login(page, "laspopas@ejemplo.com");
  await page.goto("/portal/las-popas/presupuesto");
  const card = page.locator("li", { hasText: "Noviembre 2026" });
  await expect(card.getByText("Vencido")).toBeVisible();
  await card.getByRole("button", { name: "Informar pago" }).click();
  await page.setInputFiles("#receipt", { name: "comprobante.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: "Enviar comprobante" }).click();
  await expectToast(page, "Tana va a confirmar");
  await expect(page.locator("li", { hasText: "Noviembre 2026" }).getByText("Informado", { exact: true })).toBeVisible();

  await login(page, "socia1@tana.studio");
  await page.goto("/clientes/las-popas/presupuesto");
  const adminCard = page.locator("li", { hasText: "Noviembre 2026" });
  await adminCard.getByRole("link", { name: "Comprobante" }).isVisible();
  await adminCard.getByRole("button", { name: "Confirmar pago" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expectToast(page, "Marcado como pagado");
  await expect(page.locator("li", { hasText: "Noviembre 2026" }).getByText("Pagado", { exact: true })).toBeVisible();
});

test("generar diciembre desde la plantilla", async ({ page }) => {
  await login(page, "socia1@tana.studio");
  await page.goto("/clientes/roma/calendario?y=2026&m=12");
  await page.getByRole("button", { name: "Generar mes desde plantilla" }).click();
  await expectToast(page, /Se crearon \d+ piezas/);
  await page.getByRole("tab", { name: "Mes" }).click();
  // Martes 1/12 a las 18:00 (carrusel) y jueves 31/12 a las 19:00 (reel)
  await expect(page.getByLabel("Martes 1 de diciembre", { exact: true }).getByText("18:00")).toBeVisible();
  await expect(page.getByLabel("Jueves 31 de diciembre", { exact: true }).getByText("19:00")).toBeVisible();
});

test("arrastrar una pieza a otro día", async ({ page }) => {
  await login(page, "socia1@tana.studio");
  await page.goto("/clientes/las-popas/calendario?y=2026&m=11");
  await page.getByRole("tab", { name: "Mes" }).click();
  const chip = page.getByLabel("Lunes 30 de noviembre", { exact: true }).getByRole("link").first();
  const target = page.getByLabel("Sábado 28 de noviembre", { exact: true });
  await chip.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 150);
  const a = await chip.boundingBox();
  const b = await target.boundingBox();
  await page.mouse.move(a!.x + 10, a!.y + 8);
  await page.mouse.down();
  await page.mouse.move(a!.x + 30, a!.y + 20, { steps: 5 });
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 15 });
  await page.mouse.up();
  await expectToast(page, /Movida al sábado 28 de noviembre/);
  await page.reload();
  await page.getByRole("tab", { name: "Mes" }).click();
  await expect(page.getByLabel("Sábado 28 de noviembre", { exact: true }).getByRole("link")).toHaveCount(1);
});

test("alta de un tercer cliente con el asistente", async ({ page }) => {
  await login(page, "socia1@tana.studio");
  await page.goto("/clientes/nuevo");
  await page.getByLabel("Nombre de la marca *").fill("Café Prueba");
  await page.getByLabel("Rubro").fill("Cafetería");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Estado de Planificación mensual de contenidos").selectOption("activo");
  await page.getByLabel("Email").fill("cafe@ejemplo.com");
  await page.getByRole("button", { name: "Sumar" }).click();
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page).toHaveURL(/\/clientes\/cafe-prueba\/calendario/);
  await page.getByRole("button", { name: "Generar mes desde plantilla" }).click();
  await expectToast(page, /Se crearon \d+ piezas/);
  await page.goto("/clientes/cafe-prueba/usuarios");
  await expect(page.getByText("cafe@ejemplo.com")).toBeVisible();
});

test("portal usable en celular (375 px) sin scroll horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
  const page = await ctx.newPage();
  await login(page, "roma@ejemplo.com");
  for (const path of ["/portal/roma", "/portal/roma/calendario", "/portal/roma/presupuesto", "/portal/roma/guia"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await ctx.close();
});
