import { createClient } from "npm:@supabase/supabase-js@2";

const headersCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function responder(cuerpo: Record<string, unknown>, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...headersCors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (solicitud) => {
  if (solicitud.method === "OPTIONS") return new Response("ok", { headers: headersCors });
  if (solicitud.method !== "POST") return responder({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const claveServicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = solicitud.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !claveServicio) return responder({ error: "Falta la configuración del servidor." }, 500);
  if (!token) return responder({ error: "Sesión requerida." }, 401);

  const supabase = createClient(url, claveServicio, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser(token);
  if (errorSesion || !sesion.user) return responder({ error: "Sesión inválida." }, 401);

  const { data: acceso } = await supabase
    .from("usuario_roles")
    .select("roles!inner(codigo)")
    .eq("usuario_id", sesion.user.id)
    .eq("roles.codigo", "administrador")
    .maybeSingle();
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo")
    .eq("id", sesion.user.id)
    .maybeSingle();
  if (!acceso || !perfil?.activo) return responder({ error: "Acceso administrativo requerido." }, 403);

  const datos = await solicitud.json().catch(() => null);
  const correo = String(datos?.correo || "").trim().toLowerCase();
  const password = String(datos?.password || "");
  const nombres = String(datos?.nombres || "").trim();
  const apellidos = String(datos?.apellidos || "").trim();
  const rol = String(datos?.rol || "cliente");
  const activo = datos?.activo !== false;

  if (!correo || !correo.includes("@") || password.length < 8 || !nombres) {
    return responder({ error: "Correo, nombre y contraseña de 8 caracteres son obligatorios." }, 400);
  }
  if (!["cliente", "empleado", "administrador"].includes(rol)) {
    return responder({ error: "Rol inválido." }, 400);
  }

  const { data: nuevo, error: errorCreacion } = await supabase.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { nombres, apellidos },
  });
  if (errorCreacion || !nuevo.user) {
    return responder({ error: errorCreacion?.message || "No se pudo crear el usuario." }, 400);
  }

  const { data: rolEncontrado, error: errorRol } = await supabase
    .from("roles")
    .select("id")
    .eq("codigo", rol)
    .single();
  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .upsert({ id: nuevo.user.id, nombres, apellidos, activo });
  const { error: errorAsignacion } = rolEncontrado
    ? await supabase.from("usuario_roles").upsert({ usuario_id: nuevo.user.id, rol_id: rolEncontrado.id })
    : { error: errorRol };

  if (errorPerfil || errorAsignacion || errorRol) {
    console.error("No se pudo completar el perfil:", errorPerfil || errorAsignacion || errorRol);
    await supabase.auth.admin.deleteUser(nuevo.user.id);
    return responder({ error: "No se pudo completar el perfil del usuario." }, 500);
  }

  return responder({ id: nuevo.user.id }, 201);
});
