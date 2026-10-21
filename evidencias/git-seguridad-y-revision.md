# Git, privacidad y revisión — 21 de octubre de 2026

## Hechos comprobados

- Al iniciar, fase-3-backend estaba en 9c15d7b; main y fase-4-despliegue en 7edaa5b. El árbol estaba limpio. Se creó correcciones-fases-3-4 desde la versión más reciente; las referencias originales se conservaron.
- Los cinco últimos commits consultados de fase-4-despliegue tienen el autor YamelyOvalles. Eso no significa que todo el repositorio pertenezca a una sola integrante: git shortlog --all encontró ocho nombres de autor, con 37, 20, 5, 2, 2, 1, 1 y 1 commits en las referencias disponibles antes de esta entrega. Son nombres de autor de Git, no una validación de identidades ni una medición de esfuerzo.
- La punta local de fase-2-javascript tiene un archivo raíz .env versionado. La inspección sin imprimir valores detectó dos variables y un correo. No se incluye su contenido en esta entrega.
- El .gitignore de esa rama ya menciona .env, pero Git sigue rastreando archivos agregados anteriormente. En la rama de correcciones no hay archivos privados .env versionados; solo las plantillas. git check-ignore confirmó la exclusión de los archivos privados.
- El historial local disponible contiene un merge de PR #12; no permite demostrar el estado del PR #13. No estaba instalada la CLI gh y las consultas web al PR #13 y a sus revisiones no devolvieron contenido accesible. No se afirma que haya sido aprobado, rechazado o revisado. El señalamiento del facilitador queda pendiente de contrastar en GitHub con acceso autorizado.
- No se modificaron autores, fechas de contribuciones ni historial existente. No se realizaron merge, push, force push ni revisiones artificiales durante estas correcciones.

## Retirar .env de la versión actual de Fase 2

La rama original se conservó, conforme al alcance solicitado. Por eso .env sigue presente en esa referencia y su retirada requiere una intervención separada del responsable. El siguiente procedimiento está preparado, **no ejecutado**. Utilizar una copia de trabajo aislada y una rama de mantenimiento evita mezclarlo con esta entrega:

```powershell
git switch fase-2-javascript
git switch -c mantenimiento-retirar-env-fase2
git rm --cached -- .env
git check-ignore --no-index .env
git status --short
git commit -m "Retira archivo privado del seguimiento de Fase 2"
```

Revisar solamente los nombres de archivos preparados; no copiar el contenido de .env a terminales, informes, capturas o cuerpos de PR. Después, el responsable puede autorizar publicar esa rama y solicitar revisión real para incorporarla a Fase 2. No se ha publicado ese procedimiento ni se ha creado esa rama desde esta entrega.

Esto elimina el archivo de una versión futura, no de commits anteriores. Un correo personal requiere evaluar privacidad; no es por sí mismo una contraseña. Toda contraseña o clave reutilizada o expuesta en otros documentos debe rotarse en el proveedor correspondiente. La contraseña administrativa publicada en el informe académico debe cambiarse en Supabase Auth; **la rotación remota no se ha realizado ni verificado**.

## Limpieza opcional del historial compartido

Esta operación necesita autorización explícita y coordinación de todo el equipo. Preparación recomendada:

1. Congelar temporalmente publicaciones, inventariar ramas/tags afectados y guardar una copia privada del repositorio. La copia también contiene la información expuesta y no debe compartirse públicamente.
2. Rotar primero las credenciales comprometidas. Limpiar Git no invalida una contraseña o token.
3. En una copia nueva y aislada, evaluar git-filter-repo para retirar únicamente la ruta raíz .env de las referencias acordadas. Un ejemplo de filtrado local es `git filter-repo --path .env --invert-paths`. No se ha ejecutado.
4. Comparar referencias, archivos e historial resultante; comprobar que las contribuciones legítimas se mantienen y repetir las pruebas del proyecto.
5. Obtener autorización específica para reemplazar referencias remotas. Esta entrega no contiene ni ejecuta comandos force push. Coordinar nuevos clones del equipo y la gestión de cachés/PR con GitHub cuando corresponda.

La herramienta y sus límites están documentados por [git-filter-repo](https://github.com/newren/git-filter-repo). Reescribir elimina y cambia identificadores históricos; no sirve para crear contribuciones ni revisiones que no ocurrieron.

## Verificar PR #13 y corregir el informe académico

Con acceso real al repositorio, el responsable debe abrir PR #13 y revisar su línea de tiempo, merge y revisiones. Si dispone de GitHub CLI autenticada, puede consultar, sin modificar nada:

```powershell
gh pr view 13 --repo YamelyOvalles/Proyecto_libreria --json url,state,mergedAt,mergeCommit,reviews
gh api repos/YamelyOvalles/Proyecto_libreria/pulls/13/reviews
```

Registrar únicamente los hechos observados: autor de cada revisión, estado y fecha. Un comentario, una autoaprobación o un merge no equivalen a la revisión de otro integrante. Si no hay revisión, el informe debe decir que se fusionó sin revisión registrada; no afirmar aprobación. El informe académico externo no está entre los archivos editables del repositorio inspeccionado, por lo que su actualización corresponde al equipo.

La siguiente entrega debe recibir revisión técnica efectiva de otro integrante. Su participación requiere leer el diff, ejecutar pruebas y registrar observaciones/aprobación reales. No puede reconstruirse retrospectivamente ni sustituirse por commits con autoría ajena.

## Antes de producción

- Proveer las variables privadas de Auth Admin y sesiones en el host; verificar permisos y RLS instalados realmente en el proyecto remoto.
- La cuenta PostgreSQL del almacén debe ser propietaria exclusivamente de application_sessions, o disponer de una política específica que permita al servidor usar esa tabla. Con RLS activo, otorgar solo CRUD a un rol sin política no basta. El propietario de la base debe preparar ese acceso; no se ha creado ningún rol remoto.
- Verificar conexión TLS, proxy confiable, cookies Secure en HTTPS real y persistencia entre instancias. Las pruebas locales que simulan el proxy no sustituyen esta comprobación.
- Agregar un limitador de intentos compartido si se despliegan varias instancias; actualmente el límite de intentos es por proceso.
- Registrar la rotación de credenciales cuando se realice, sin incluir los valores. No marcarla completada por tener un procedimiento escrito.
