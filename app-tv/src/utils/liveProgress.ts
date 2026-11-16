// HLS can report buffering while its playback position continues advancing.
export function hasLiveProgress(previous: number, current: number): boolean {
  return Number.isFinite(current) && Math.abs(current - previous) >= 250;
}
