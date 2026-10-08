const { test, expect } = require('@playwright/test');
test('login conserva formulario, alterna personal/cliente y rechaza contraseña corta', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login.html');
    await expect(page.locator('#login-form')).toBeVisible();
    await page.locator('#role-admin').click(); await expect(page.locator('#login-title')).toHaveText('Acceso del personal');
    await page.locator('#role-client').click();
    await page.locator('#email').fill('demo@example.test'); await page.locator('#password').fill('short');
    await page.locator('#login-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await expect(page.locator('#login-message')).toContainText('8 caracteres');
    expect(errors).toEqual([]);
});
test('visitante se redirige desde ambas rutas del panel y no ve formularios administrativos', async ({ page }) => {
    for (const path of ['/admin', '/admin.html']) {
        await page.goto(path); await expect(page).toHaveURL(/login\.html$/);
        await expect(page.locator('#login-form')).toBeVisible();
    }
});
test('páginas públicas mantienen navegación y contacto sin errores de JavaScript', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/informacion.html', '/formulario.html', '/tienda.html']) {
        await page.goto(path); await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(200);
    }
    expect(errors).toEqual([]);
});
