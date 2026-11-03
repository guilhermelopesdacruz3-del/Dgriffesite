/**
 * Favoritos de visitante (Fase 5): guarda os slugs marcados no coração
 * enquanto o cliente não tem sessão. Com sessão, o `toggleFavorite`
 * (server action) sincroniza com o banco — o localStorage fica como backup
 * do toque imediato na UI.
 */
const KEY = "pierre:favoritos";

export function getLocalFavoriteSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Adiciona/remove um slug da lista local (idempotente). */
export function setLocalFavorite(slug: string, faved: boolean) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalFavoriteSlugs().filter((s) => s !== slug);
    if (faved) list.push(slug);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage cheio/bloqueado: o toque ainda vale enquanto a página viver
  }
}
