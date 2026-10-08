const { test, expect } = require('@playwright/test');
async function login(page, email) {
    await page.goto('/login.html');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('DemoLocal-306!');
    await page.locator('#login-submit-btn').click();
}
test('cliente inicia sesión, conserva sesión al recargar y cierra sesión', async ({ page }) => {
    await login(page, 'cliente@demo.local'); await expect(page).toHaveURL(/informacion\.html$/);
    await page.reload(); await expect(page.locator('.account-trigger')).toBeVisible();
    await page.locator('.account-trigger').click(); await page.locator('[data-logout]').click();
    await expect(page).toHaveURL(/informacion\.html$/);
    await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('libreria.auth'))).toBeNull();
});
test('inactivo recibe rechazo y empleado no ve módulos de administrador', async ({ page }) => {
    await login(page, 'inactivo@demo.local'); await expect(page.locator('#login-message')).toContainText('no está activa');
    await login(page, 'empleado@demo.local'); await expect(page).toHaveURL(/admin\.html$/);
    await expect(page.locator('[data-admin-view="productos"]')).toBeHidden();
    await expect(page.locator('[data-admin-view="pedidos"]')).toBeVisible();
});
test('administrador crea, edita y elimina producto desde la interfaz existente', async ({ page }) => {
    await login(page, 'admin@demo.local'); await expect(page).toHaveURL(/admin\.html$/);
    await page.locator('[data-admin-view="productos"]').click();
    const title = `Demo navegador ${Date.now()}`;
    await page.locator('#new-product-btn').click();
    await page.locator('#product-title').fill(title);
    await page.locator('#product-price').fill('100');
    await page.locator('#product-stock').fill('3');
    await page.locator('#product-form [type="submit"]').click();
    await expect(page.locator('#product-dialog')).not.toBeVisible();
    await page.locator('#product-search').fill(title);
    const row = page.locator('#products-table-body tr').filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Editar/ }).click();
    await page.locator('#product-title').fill(`${title} editado`);
    await page.locator('#product-form [type="submit"]').click();
    await expect(row).toContainText('editado');
    page.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: /Eliminar/ }).click();
    await expect(row).toHaveCount(0);
});
