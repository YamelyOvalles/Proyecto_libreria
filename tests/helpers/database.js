const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
// PostgreSQL real en WASM. Estos esquemas mínimos NO ejecutan GoTrue ni Storage HTTP.
async function freshDatabase() {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
        create schema extensions;
        create schema auth;
        create schema storage;
        create table auth.users (id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as
            $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;
        create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
        alter table storage.objects enable row level security;
        grant usage on schema storage to anon, authenticated;
        grant select, insert, update, delete on storage.objects to anon, authenticated;
        -- Supabase instala permisos predeterminados. Replicarlos permite detectar exposición accidental.
        alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
        alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    `);
    await db.exec(fs.readFileSync('database/database.sql', 'utf8'));
    return db;
}
const ids = {
    cliente: '00000000-0000-4000-8000-000000000001',
    otro: '00000000-0000-4000-8000-000000000002',
    empleado: '00000000-0000-4000-8000-000000000003',
    administrador: '00000000-0000-4000-8000-000000000004',
    inactivo: '00000000-0000-4000-8000-000000000005'
};
async function seedIdentities(db) {
    for (const [role, id] of Object.entries(ids)) {
        await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)`,
            [id, `${role}@demo.local`, JSON.stringify({ nombres: role, rol: 'administrador' })]);
        if (['administrador', 'empleado'].includes(role)) {
            await db.query(`update public.usuario_roles set rol_id=(select id from public.roles where codigo=$1) where usuario_id=$2`, [role, id]);
        }
    }
    await db.query('update public.perfiles set activo=false where id=$1', [ids.inactivo]);
}
async function asUser(db, id, action) {
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
    try { return await action(); }
    finally { await db.exec('reset role'); }
}
module.exports = { freshDatabase, seedIdentities, asUser, ids };
