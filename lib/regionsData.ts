let cached: string | null = null;
// El mapa de estados pesa ~2 MB: se carga solo cuando se abre un perfil y se guarda en memoria.
export function getRegionsJson(): string {
  if (cached === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = JSON.stringify(require('../assets/regions.json'));
  }
  return cached;
}
