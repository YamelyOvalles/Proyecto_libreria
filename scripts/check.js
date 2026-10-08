const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let failed = false;
function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) check(file);
        else if (file.endsWith('.js') || file.endsWith('.cjs')) {
            const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
            if (result.status !== 0) failed = true;
        }
    }
}
for (const directory of ['server', 'api', 'js', 'scripts', 'tests']) check(directory);
for (const file of ['playwright.config.js', 'playwright.local.config.js']) {
    if (fs.existsSync(file) && spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }).status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
