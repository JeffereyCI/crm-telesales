/**
 * Mode SPA: sesi auth (JWT) disimpan di sessionStorage yang hanya ada di
 * browser. SSR dimatikan agar guard & store membaca token tanpa mismatch
 * hydration, dan agar `load` guard berjalan di sisi klien.
 */
export const ssr = false;
export const prerender = false;
