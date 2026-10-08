-- SOLO LECTURA: definiciones de las funciones de la aplicación, sin consultar registros.
-- Ejecutar en SQL Editor del mismo proyecto y exportar la fila como JSON.
-- Revisar el código antes de compartirlo por si contiene secretos incrustados manualmente.
select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'body_md5', md5(replace(p.prosrc, chr(13), '')),
    'definition', pg_get_functiondef(p.oid)
) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
as function_definitions
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f'
    and not exists (
        select 1 from pg_depend dep
        where dep.classid='pg_proc'::regclass and dep.objid=p.oid and dep.deptype='e'
    );
