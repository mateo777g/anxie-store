// ================================================================
// supabase-config.js
// Cliente compartido de Supabase para páginas PÚBLICAS
// → Usar en: index.html y catalogo.html
// → NO usar en: lilshop.html (el admin necesita auth real)
//
// ¿Por qué persistSession: false?
// El console mostraba "Tracking Prevention blocked access to storage"
// (4 veces en catalogo.html). Esto ocurre porque Edge y Safari bloquean
// que el SDK de Supabase (que viene de cdn.jsdelivr.net) guarde tokens
// en localStorage. Cuando falla, Supabase re-inicializa auth completa
// → eso genera las 312 llamadas a SELECT name FROM pg_timezone_names
// que consumían el 67% del tiempo de la base de datos.
// Con persistSession: false, el SDK ni lo intenta. Problema eliminado.
// ================================================================

const SUPABASE_URL = 'https://jayxntvpiduxvgvluaky.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpheXhudHZwaWR1eHZndmx1YWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDgxNjMsImV4cCI6MjEwMjIyNDE2M30.U7Hrie3HIBAcp_2fYU0YHgP8McGnpYYYjdBiW-9AMjw';

const { createClient } = supabase;

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,       // No guardar sesión en localStorage
        autoRefreshToken: false,     // No re-autenticar automáticamente  
        detectSessionInUrl: false    // No buscar tokens de auth en la URL
    }
});
