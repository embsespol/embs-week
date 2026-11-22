/* Configuración pública del concurso de fotografía.
   Estas claves son públicas por diseño: pueden estar en la página.
   NUNCA pongas aquí la clave secreta ni la service_role de Supabase. */
window.EMBS_CONFIG = {
  supabaseUrl: "https://wywloklnfhepzozigoqq.supabase.co",
  supabaseKey: "sb_publishable_EZkedajPE-Z9yu7Q7qNFyQ_DlPYwfQo",
  turnstileSiteKey: "0x4AAAAAAGMr9N3dMXIPnkS4",
  bucket: "contest",
  // Debe coincidir con contest_open() y cooldown_minutes() del script SQL
  closesAt: "2026-11-29T23:59:59-05:00",
  cooldownMinutes: 15
};
