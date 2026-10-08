const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/local-browser', workers: 1, reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:3107', headless: true },
    webServer: {
        command: 'node --env-file=server/.env.local server/index.js',
        url: 'http://127.0.0.1:3107/api/health', reuseExistingServer: false, env: { PORT: '3107' }
    }
});
