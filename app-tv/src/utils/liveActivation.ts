export function shouldAttemptLivePlayback(serverRequested: boolean, retryNotBefore: number, now = Date.now()) {
  return serverRequested && now >= retryNotBefore;
}
