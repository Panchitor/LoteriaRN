export type ServerSource = 'primary' | 'secondary';

export const MAINTENANCE_NOTICE =
  'Servidor principal en mantenimiento. Las actualizaciones de contenido pueden demorar.';

export function allowsSecondaryFailover(method?: string): boolean {
  const normalized = (method || 'GET').trim().toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
}
