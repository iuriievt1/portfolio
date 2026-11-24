import type { Channel } from "@bfbs/common-sdk";

type SortableChannel = Pick<Channel, "logicalChannelNumber" | "name">;

export function sortByChannelNumber<T extends SortableChannel>(
  channels: T[],
): T[] {
  return [...channels].sort((firstChannel, secondChannel) => {
    const firstNumber = firstChannel.logicalChannelNumber ?? Number.MAX_VALUE;
    const secondNumber = secondChannel.logicalChannelNumber ?? Number.MAX_VALUE;

    if (firstNumber !== secondNumber) {
      return firstNumber - secondNumber;
    }

    return firstChannel.name.localeCompare(secondChannel.name);
  });
}
