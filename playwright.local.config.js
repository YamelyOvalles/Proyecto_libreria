const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/local-browser', workers: 1, reporter: 'list',
    use: { baseURL: 'http://localhost:3000', headless: true,
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {} },
    webServer: {
        command: 'node --env-file=server/.env.local server/index.js',
        url: 'http://localhost:3000/api/health', reuseExistingServer: false, env: { PORT: '3000' }
    }
});
