const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
dotenv.config({ path: 'scripts/.env.demo', quiet: true });
const demoPassword = process.env.DEMO_PASSWORD;
const newPassword = require('node:crypto').randomBytes(24).toString('base64url');
const local = dotenv.parse(fs.readFileSync('server/.env.local'));
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(local.SUPABASE_URL)) throw new Error('Estas pruebas solo aceptan Supabase local.');
async function login(page, email) {
    await page.goto('/login.html');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(demoPassword);
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
    await page.locator('#product-isbn').fill(`${Date.now()}`);
    await page.locator('#product-title').fill(title);
    await page.locator('#product-price').fill('100');
    await page.locator('#product-stock').fill('0');
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

test('checkout de navegador abre cotización, genera PDF y conserva el enlace tras login', async ({ page }, testInfo) => {
    await login(page, 'otro@demo.local'); await expect(page).toHaveURL(/informacion\.html$/);
    await page.goto('/tienda.html');
    const book = page.locator('.book-card').filter({ has: page.getByRole('heading', { name: '1984', exact: true }) });
    await book.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(page.locator('#cart-badge')).toHaveText('1');
    await expect(page.locator('#cart-sidebar')).toHaveClass(/open/);
    await expect(page.locator('#pickup-branch option')).toHaveCount(1);
    await page.locator('#checkout-btn').click();
    await expect(page).toHaveURL(/documento\.html\?tipo=cotizacion/);
    await expect(page.locator('#document-page')).toBeVisible();
    await expect(page.locator('#document-items')).toContainText('1984');
    const number = await page.locator('#document-number').textContent();
    const documentUrl = page.url();
    const pdf = await page.pdf({ path: testInfo.outputPath('cotizacion.pdf'), format: 'A4', printBackground: true });
    expect(pdf.subarray(0,4).toString()).toBe('%PDF'); expect(pdf.length).toBeGreaterThan(1000);
    await page.evaluate(() => window.libreriaSupabase.auth.signOut({ scope: 'local' }));
    await page.goto(documentUrl); await expect(page).toHaveURL(/login\.html\?returnTo=/);
    await page.locator('#email').fill('otro@demo.local'); await page.locator('#password').fill(demoPassword);
    await page.locator('#login-submit-btn').click();
    await expect(page.locator('#document-number')).toHaveText(number);
});

test('registro y recuperación real por correo local permiten cambiar contraseña', async ({ page, request }) => {
    const email = `registro-${Date.now()}@demo.local`;
    await page.goto('/login.html?registro=1');
    await page.locator('#email').fill(email); await page.locator('#password').fill(demoPassword);
    await page.locator('#login-submit-btn').click(); await expect(page).toHaveURL(/informacion\.html$/);
    await expect(page.locator('.account-trigger')).toBeVisible();
    await page.locator('.account-trigger').click(); await page.locator('[data-logout]').click();
    await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible();
    await page.goto('/login.html'); await page.locator('#email').fill(email);
    await page.locator('[data-recover]').click();
    await expect(page.locator('#login-message')).toContainText('Revisa tu correo');
    // Mailpit is the CLI's local mailbox; recovery tokens stay in memory.
    let messages;
    await expect.poll(async () => {
        const inbox = await (await request.get('http://127.0.0.1:54324/api/v1/messages')).json();
        messages = inbox.messages.filter(item => item.To.some(recipient => recipient.Address === email));
        return messages.length;
    }).toBeGreaterThan(0);
    const mail = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messages[0].ID}`)).json();
    const link = mail.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
    const response = await request.get(link, { maxRedirects: 0 });
    const destination = new URL(response.headers().location);
    // Abrir el enlace del correo carga una página nueva, no cambia solo el hash.
    await page.goto('about:blank');
    await page.goto(destination.href);
    await expect(page.locator('#login-submit-btn')).toHaveText('Actualizar contraseña');
    await page.locator('#password').fill(newPassword); await page.locator('#login-submit-btn').click();
    await expect(page.locator('#login-message')).toContainText('Contraseña actualizada');
    const sdk = createClient(local.SUPABASE_URL, local.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await sdk.auth.signInWithPassword({ email, password: demoPassword })).error).toBeTruthy();
    expect((await sdk.auth.signInWithPassword({ email, password: newPassword })).error).toBeNull();
    await sdk.auth.signOut({ scope: 'local' });
});
