// ================================================================
// worker/index.js
// Backend de subida/borrado de imágenes para lilshop.html (Anxie Store).
//
// Por qué existe: lilshop.html es HTML estático servido en Hostinger,
// sin backend propio. Para subir/borrar en R2 sin exponer ninguna
// credencial en el navegador, este Worker tiene acceso nativo al
// bucket (binding R2, sin Access Key/Secret) y es él quien escribe.
//
// Autenticación: cada request debe traer el access_token de la sesión
// de Supabase Auth del admin (Authorization: Bearer <token>). Este
// Worker valida ese token contra la API de Supabase Auth y confirma
// que el email coincide con ADMIN_EMAIL antes de tocar el bucket.
// Así nadie puede subir/borrar sin haber iniciado sesión en el panel.
// ================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function verificarAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) return null;

  const user = await resp.json();
  if (!user || user.email !== env.ADMIN_EMAIL) return null;
  return user;
}

// Nombre de archivo generado por el servidor (nunca confiar en uno
// provisto por el cliente) -- mismo patron que ya usaba el proyecto.
function nombreNuevo() {
  return `${Date.now()}.webp`;
}

// El cliente (lilshop.html) ya comprime a WebP calidad 80 antes de subir,
// pero no hay que confiar solo en eso -- un cliente modificado o un bug
// podría mandar algo enorme. Este límite es la misma clase de protección
// que ya se aplicó en Fase 1/2 (evitar que Storage crezca sin control).
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Solo permite borrar archivos con este patrón exacto -- evita que
// un valor raro en `file` (ej. con "../") toque otra cosa del bucket.
const NOMBRE_VALIDO = /^[0-9]+\.webp$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      const user = await verificarAdmin(request, env);
      if (!user) return json({ ok: false, error: "No autorizado." }, 401);

      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("image/webp")) {
        return json({ ok: false, error: "Solo se aceptan imágenes WebP." }, 400);
      }

      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > MAX_BYTES) {
        return json({ ok: false, error: "La imagen supera el límite de 5 MB." }, 413);
      }

      const fileName = nombreNuevo();
      await env.FOTOS.put(fileName, request.body, {
        httpMetadata: { contentType: "image/webp" },
      });

      return json({ ok: true, fileName, url: `${env.R2_PUBLIC_BASE}/${fileName}` });
    }

    if (url.pathname === "/delete" && request.method === "DELETE") {
      const user = await verificarAdmin(request, env);
      if (!user) return json({ ok: false, error: "No autorizado." }, 401);

      const file = url.searchParams.get("file") || "";
      if (!NOMBRE_VALIDO.test(file)) {
        return json({ ok: false, error: "Nombre de archivo inválido." }, 400);
      }

      await env.FOTOS.delete(file);
      return json({ ok: true });
    }

    return json({ ok: false, error: "No encontrado." }, 404);
  },
};
