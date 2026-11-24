import type { CreatePlaySessionInput } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { usePlaybackAuthorization } from "@/features/auth/auth-session-context";
import { playSessionQueryOptions } from "../playback-queries";

/** Loads player sessions through the same integrity gate used by playback launches. */
export function usePlaySession(input: CreatePlaySessionInput | null) {
  const authorizePlayback = usePlaybackAuthorization();
  return useQuery(playSessionQueryOptions(input, authorizePlayback));
}
