export type LocalRecoveryAction = 'none' | 'resume' | 'remount' | 'next' | 'replay';

export function localRecoveryAction(
  stalledMs: number,
  recoveryStage: number,
  hasMultipleVideos: boolean,
): LocalRecoveryAction {
  if (stalledMs >= 30_000 && recoveryStage >= 2) return hasMultipleVideos ? 'next' : 'replay';
  if (stalledMs >= 18_000 && recoveryStage < 2) return 'remount';
  if (stalledMs >= 8_000 && recoveryStage < 1) return 'resume';
  return 'none';
}
