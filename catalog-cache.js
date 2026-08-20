// ================================================================
// catalog-cache.js
// Capa de caché para datos del catálogo
// → Usar en: index.html y catalogo.html
// → REQUIERE: supabase-config.js cargado ANTES que este archivo
//
// ¿Qué resuelve?
// Antes: cada página hacía select('*') completo al abrir.
// Un usuario que entraba a index.html y luego iba a catalogo.html
// generaba DOS consultas completas a Supabase, más el egress de datos.
// Ahora: la primera consulta guarda los datos en sessionStorage.
// Las páginas siguientes los leen de ahí sin tocar Supabase.
// El caché dura 5 minutos por sesión de navegador.
// ================================================================

const CACHE_KEY = 'anxie_catalog_v1';
const CACHE_DURACION_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Devuelve los datos del catálogo.
 * Primero revisa sessionStorage. Si hay datos frescos, los usa.
 * Si no, consulta Supabase con SOLO las columnas necesarias.
 */
async function getCatalogData() {

    // — PASO 1: Revisar si hay caché válido —
    try {
        const cachedStr = sessionStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            const edadMs = Date.now() - cached.timestamp;

            if (edadMs < CACHE_DURACION_MS) {
                // Caché fresco (menos de 5 min), no se toca Supabase
                return cached.data;
            }
        }
    } catch (e) {
        // sessionStorage puede estar bloqueado por privacidad. Ignorar y continuar.
    }

    // — PASO 2: No hay caché → consultar Supabase —
    // IMPORTANTE: select() SOLO con las columnas que usa la UI.
    // Antes era select('*') → descargaba columnas innecesarias en cada visita.
    const { data, error } = await _supabase
        .from('Cuentas')
        .select('id, titulo, preciomxn, preciousd, image_url, disponibilidad, created_at');

    if (error) throw error;

    const resultado = data || [];

    // — PASO 3: Guardar en sessionStorage —
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data: resultado,
            timestamp: Date.now()
        }));
    } catch (e) {
        // No se pudo guardar (cuota llena o bloqueado). No importa, seguimos.
    }

    return resultado;
}

/**
 * Borra el caché del catálogo.
 * Llamar después de agregar, editar o eliminar una cuenta en el admin.
 * Así el catálogo público se actualiza en la siguiente visita.
 */
function clearCatalogCache() {
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {}
}
