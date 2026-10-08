-- SOLO LECTURA. Ejecutar en SQL Editor de Supabase y exportar la fila como JSON.
-- No devuelve registros de clientes, usuarios, pedidos ni claves.
-- Compara estructura y permisos; Auth/OAuth/SMTP y Edge Functions se configuran fuera de SQL.
select jsonb_build_object(
    'tables', coalesce((
        select jsonb_agg(jsonb_build_object(
            'schema', n.nspname, 'name', c.relname,
            'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
            'columns', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
                    'not_null', a.attnotnull, 'identity', a.attidentity,
                    'generated', a.attgenerated, 'default', pg_get_expr(d.adbin, d.adrelid),
                    'privileges', jsonb_build_object(
                        'anon_select', has_column_privilege('anon', c.oid, a.attnum, 'SELECT'),
                        'authenticated_select', has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT'),
                        'authenticated_insert', has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT'),
                        'authenticated_update', has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')
                    )
                ) order by a.attnum)
                from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
                where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
            ), '[]'::jsonb),
            'constraints', coalesce((
                select jsonb_agg(jsonb_build_object('name', x.conname, 'definition', pg_get_constraintdef(x.oid)) order by x.conname)
                from pg_constraint x where x.conrelid=c.oid
            ), '[]'::jsonb),
            'privileges', jsonb_build_object(
                'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
                'anon_insert', has_table_privilege('anon', c.oid, 'INSERT'),
                'anon_update', has_table_privilege('anon', c.oid, 'UPDATE'),
                'anon_delete', has_table_privilege('anon', c.oid, 'DELETE'),
                'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
                'authenticated_insert', has_table_privilege('authenticated', c.oid, 'INSERT'),
                'authenticated_update', has_table_privilege('authenticated', c.oid, 'UPDATE'),
                'authenticated_delete', has_table_privilege('authenticated', c.oid, 'DELETE'),
                'service_select', has_table_privilege('service_role', c.oid, 'SELECT'),
                'service_insert', has_table_privilege('service_role', c.oid, 'INSERT'),
                'service_update', has_table_privilege('service_role', c.oid, 'UPDATE'),
                'service_delete', has_table_privilege('service_role', c.oid, 'DELETE')
            )
        ) order by c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind in ('r','p')
    ), '[]'::jsonb),
    'functions', coalesce((
        select jsonb_agg(jsonb_build_object(
            'schema', n.nspname, 'name', p.proname,
            'identity_arguments', pg_get_function_identity_arguments(p.oid),
            'arguments', pg_get_function_arguments(p.oid),
            'parameter_names', coalesce(to_jsonb(p.proargnames), '[]'::jsonb),
            'result', pg_get_function_result(p.oid),
            'language', lang.lanname, 'volatility', p.provolatile, 'strict', p.proisstrict,
            'security_definer', p.prosecdef, 'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
            'body_md5', md5(replace(p.prosrc, chr(13), '')),
            'privileges', jsonb_build_object(
                'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
                'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
                'service_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
            )
        ) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language lang on lang.oid=p.prolang
        where n.nspname in ('public','private') and p.prokind='f'
          and not exists (select 1 from pg_depend dep where dep.classid='pg_proc'::regclass and dep.objid=p.oid and dep.deptype='e')
    ), '[]'::jsonb),
    'policies', coalesce((
        select jsonb_agg(jsonb_build_object(
            'schema', schemaname, 'table', tablename, 'name', policyname,
            'permissive', permissive, 'roles', to_jsonb(roles), 'command', cmd,
            'using', qual, 'with_check', with_check
        ) order by schemaname,tablename,policyname)
        from pg_policies where schemaname in ('public','private')
            or (schemaname='storage' and tablename='objects')
    ), '[]'::jsonb),
    'triggers', coalesce((
        select jsonb_agg(jsonb_build_object(
            'schema', n.nspname, 'table', c.relname, 'name', t.tgname,
            'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid)
        ) order by n.nspname,c.relname,t.tgname)
        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        join pg_proc p on p.oid=t.tgfoid join pg_namespace fn on fn.oid=p.pronamespace
        where not t.tgisinternal and (n.nspname='public' or fn.nspname in ('public','private'))
    ), '[]'::jsonb),
    'indexes', coalesce((
        select jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', indexname, 'definition', indexdef)
            order by tablename,indexname)
        from pg_indexes where schemaname='public'
    ), '[]'::jsonb),
    'sequences', coalesce((
        select jsonb_agg(jsonb_build_object(
            'schema', schemaname, 'name', sequencename, 'type', data_type,
            'start', start_value, 'min', min_value, 'max', max_value, 'increment', increment_by, 'cycle', cycle
        ) order by sequencename)
        from pg_sequences where schemaname='public'
    ), '[]'::jsonb),
    'views', coalesce((
        select jsonb_agg(jsonb_build_object('schema', schemaname, 'name', viewname, 'definition', definition) order by viewname)
        from pg_views where schemaname in ('public','private')
    ), '[]'::jsonb),
    'buckets', coalesce((
        select jsonb_agg(jsonb_build_object('name', name, 'public', public, 'file_size_limit', file_size_limit,
            'allowed_mime_types', to_jsonb(allowed_mime_types)) order by name)
        from storage.buckets
    ), '[]'::jsonb)
) as schema_snapshot;
