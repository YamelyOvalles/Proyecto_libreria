const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/browser', workers: 1, reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:3106', headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } } : {}) },
    webServer: { command: 'node tests/helpers/ui-server.js', url: 'http://127.0.0.1:3106/api/health', reuseExistingServer: false }
});
