const { test, expect } = require('@playwright/test');

test('sesión de Express persiste entre páginas, no guarda tokens en Storage y termina en logout (proveedor simulado)', async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login.html');
    await page.locator('#email').fill('lector@example.test');
    await page.locator('#password').fill('fictional-browser-password');
    await page.locator('#login-submit-btn').click();
    await expect(page).toHaveURL(/informacion\.html$/);
    await expect(page.locator('.account-trigger')).toBeVisible();
    await page.reload();
    await expect(page.locator('.account-trigger')).toBeVisible();
    const state = await page.evaluate(() => ({ storage: sessionStorage.getItem('libreria.auth'),
        identity: sessionStorage.getItem('libreria.usuario'), cookies: document.cookie,
        local: localStorage.getItem('libreria.auth') }));
    expect(state.storage).toBeNull(); expect(state.identity).toBeNull(); expect(state.local).toBeNull();
    expect(state.cookies).not.toContain('lq.sid');
    expect((await context.cookies()).find(cookie => cookie.name === 'lq.sid').httpOnly).toBe(true);
    const session = await page.request.get('/api/supabase/session');
    expect(await session.text()).not.toContain('internal-provider-test');
    const forbidden = await page.request.get('/admin.html'); expect(forbidden.status()).toBe(403);
    await page.locator('.account-trigger').click();
    await page.locator('[data-logout]').click();
    await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible();
    expect(await (await page.request.get('/api/supabase/session')).json()).toBeNull();
    expect(errors).toEqual([]);
});
