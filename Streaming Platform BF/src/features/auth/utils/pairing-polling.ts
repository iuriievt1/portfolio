import type { DevicePairingPollResult } from "@bfbs/common-sdk";
import { DevicePairingPollStatus } from "@bfbs/common-sdk";

const DEFAULT_PAIRING_POLL_INTERVAL_SECONDS = 5;

export function getInitialPairingPollIntervalSeconds(intervalSeconds?: number) {
  return intervalSeconds ?? DEFAULT_PAIRING_POLL_INTERVAL_SECONDS;
}

export function getNextPairingPollIntervalSeconds({
  currentIntervalSeconds,
  result,
}: {
  currentIntervalSeconds: number;
  result: DevicePairingPollResult;
}) {
  if (
    result.status === DevicePairingPollStatus.PENDING &&
    result.intervalSeconds !== undefined
  ) {
    return result.intervalSeconds;
  }

  if (result.status === DevicePairingPollStatus.SLOW_DOWN) {
    return currentIntervalSeconds + result.intervalSeconds;
  }

  return currentIntervalSeconds;
}
