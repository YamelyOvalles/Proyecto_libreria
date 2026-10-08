const fs = require('node:fs');
const path = require('node:path');
const { freshDatabase } = require('../tests/helpers/database');

function sourceFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? (entry.name === 'node_modules' ? [] : sourceFiles(file)) :
            /\.(js|ts)$/.test(file) ? [file] : [];
    });
}
function applicationReferences() {
    const tables = new Set(['pedidos', 'cotizaciones', 'facturas']); // from(tabla): documentos e historial Edge.
    const rpcs = new Set();
    const buckets = new Set();
    const parameters = new Map();
    const columns = new Map();
    function inspectSelect(table, selection) {
        if (!columns.has(table)) columns.set(table, new Set());
        let depth = 0, start = 0;
        const parts = [];
        for (let i = 0; i <= selection.length; i++) {
            if (selection[i] === '(') depth++;
            if (selection[i] === ')') depth--;
            if (i === selection.length || (selection[i] === ',' && depth === 0)) {
                parts.push(selection.slice(start, i).trim()); start = i + 1;
            }
        }
        for (const part of parts) {
            const relation = /^(?:[a-z_]+:)?([a-z_]+)(?:![a-z_]+)?\((.*)\)$/s.exec(part);
            if (relation) {
                tables.add(relation[1]); inspectSelect(relation[1], relation[2]);
            } else if (part !== '*') {
                const name = part.split(':').at(-1);
                if (/^[a-z_]+$/.test(name)) columns.get(table).add(name);
            }
        }
    }
    for (const file of [...sourceFiles('js'), ...sourceFiles('server'), ...sourceFiles('supabase/functions/bright-action')]) {
        // Nunca leer configuración local ignorada: puede contener claves públicas anteriores.
        if (file.replaceAll('\\', '/') === 'js/supabase-config.js') continue;
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\.from\(\s*["']([^"']+)["']/g)) {
            (match[1] === 'portadas' ? buckets : tables).add(match[1]);
        }
        for (const match of source.matchAll(/\.from\(\s*["']([^"']+)["']\s*\)\s*\.select\(\s*["']([^"']*)["']/g)) {
            inspectSelect(match[1], match[2]);
        }
        for (const match of source.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)) rpcs.add(match[1]);
        for (const match of source.matchAll(/\/rest\/v1\/rpc\/([a-z_]+)/g)) rpcs.add(match[1]);
        for (const match of source.matchAll(/\.rpc\(\s*["']([^"']+)["']\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
            if (!parameters.has(match[1])) parameters.set(match[1], new Set());
            for (const key of match[2].matchAll(/\b(p_[a-z_]+)\s*:/g)) parameters.get(match[1]).add(key[1]);
        }
    }
    parameters.set('crear_pedido_desde_carrito', new Set([
        'p_metodo_entrega', 'p_metodo_pago', 'p_sucursal_id', 'p_direccion', 'p_notas'
    ]));
    return { tables, rpcs, buckets, parameters, columns };
}
async function localSnapshot() {
    const db = await freshDatabase();
    try { return (await db.query(fs.readFileSync('database/verificar_esquema.sql', 'utf8'))).rows[0].schema_snapshot; }
    finally { await db.close(); }
}
function checkCoverage(snapshot) {
    const references = applicationReferences();
    const errors = [];
    for (const name of references.tables) if (!snapshot.tables.some(item => item.name === name)) errors.push(`Tabla ausente: ${name}`);
    for (const [name, columnNames] of references.columns) {
        const table = snapshot.tables.find(item => item.name === name);
        for (const column of columnNames) if (!table?.columns.some(item => item.name === column)) errors.push(`Columna ausente: ${name}.${column}`);
    }
    for (const name of references.rpcs) {
        const fn = snapshot.functions.find(item => item.schema === 'public' && item.name === name);
        if (!fn) { errors.push(`RPC ausente: ${name}`); continue; }
        for (const param of references.parameters.get(name) || []) {
            if (!fn.parameter_names.includes(param)) errors.push(`Parámetro RPC ausente: ${name}.${param}`);
        }
    }
    for (const name of references.buckets) if (!snapshot.buckets.some(item => item.name === name)) errors.push(`Bucket ausente: ${name}`);
    for (const table of snapshot.tables) {
        if (!table.rls) errors.push(`RLS deshabilitada: ${table.name}`);
        if (!snapshot.policies.some(item => item.schema === 'public' && item.table === table.name)) errors.push(`Sin políticas: ${table.name}`);
    }
    return { errors, referencedTables: [...references.tables].sort(), referencedRpcs: [...references.rpcs].sort(), referencedBuckets: [...references.buckets].sort() };
}
function unwrapSnapshot(data) {
    if (Array.isArray(data)) data = data[0];
    if (data?.schema_snapshot) data = data.schema_snapshot;
    if (typeof data === 'string') data = JSON.parse(data);
    for (const section of ['tables', 'functions', 'policies', 'triggers', 'indexes', 'sequences', 'views', 'buckets']) {
        if (!Array.isArray(data?.[section])) throw new Error(`Exportación incompleta: falta ${section}. Usa database/verificar_esquema.sql.`);
    }
    return data;
}
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ?
    Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function compareSnapshots(local, remote) {
    const differences = [];
    for (const section of Object.keys(local)) {
        const key = item => [item.schema || '', item.table || '', item.name, item.identity_arguments || ''].join('.');
        const expected = new Map(local[section].map(item => [key(item), item]));
        const actual = new Map(remote[section].map(item => [key(item), item]));
        for (const [name, item] of expected) {
            if (!actual.has(name)) differences.push({ section, name, status: 'solo_local' });
            else if (stable(item) !== stable(actual.get(name))) {
                const remoteItem = actual.get(name);
                const optional = section === 'functions' ? ['language', 'volatility', 'strict'] : [];
                const unavailable = optional.filter(field => field in item && !(field in remoteItem));
                const fields = [...new Set([...Object.keys(item), ...Object.keys(remoteItem)])]
                    .filter(field => !unavailable.includes(field) && stable(item[field]) !== stable(remoteItem[field]));
                differences.push({ section, name, status: fields.length ? 'diferente' : 'metadatos_no_exportados',
                    fields_changed: fields, fields_unavailable: unavailable });
            }
        }
        for (const name of actual.keys()) if (!expected.has(name)) differences.push({ section, name, status: 'solo_remoto' });
    }
    return differences;
}
async function main() {
    const local = await localSnapshot();
    const coverage = checkCoverage(local);
    const counts = Object.fromEntries(Object.entries(local).map(([key, values]) => [key, values.length]));
    console.log(JSON.stringify({ cobertura: coverage, objetos: counts }, null, 2));
    if (coverage.errors.length) process.exitCode = 1;
    const remoteFile = process.argv[2];
    if (remoteFile) {
        const remote = unwrapSnapshot(JSON.parse(fs.readFileSync(remoteFile, 'utf8')));
        const differences = compareSnapshots(local, remote);
        console.log(JSON.stringify({ diferencias_con_exportacion_remota: differences }, null, 2));
        if (differences.length) process.exitCode = 1;
    } else console.log('Esquema remoto no comparado: falta exportación de solo lectura del proyecto.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { applicationReferences, localSnapshot, checkCoverage, unwrapSnapshot, compareSnapshots };
