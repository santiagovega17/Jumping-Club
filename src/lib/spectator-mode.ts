export function getSpectatorFranquiciaId(pathname: string): string | null {
  const match = /^\/universal-jumps\/(?:franquicia|sucursal)\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

export function isSpectatorPath(pathname: string): boolean {
  return getSpectatorFranquiciaId(pathname) !== null;
}

// Compatibilidad temporal con imports previos.
export const getSpectatorSucursalId = getSpectatorFranquiciaId;
