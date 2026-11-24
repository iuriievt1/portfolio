import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import ProgrammeImageFallback from "@/assets/icons/programme-image-fallback.svg";

const FALLBACK_SIZE = "100%";
const RETRY_DELAYS_MS = [1000, 3000] as const;

type ProgrammeArtworkProps = {
  imageUrl: string | undefined;
  priority?: "high" | "normal";
  transitionMs?: number | undefined;
};

function ProgrammeArtworkFallback() {
  return (
    <View style={StyleSheet.absoluteFill} testID="programme-artwork-fallback">
      <ProgrammeImageFallback
        height={FALLBACK_SIZE}
        preserveAspectRatio="xMidYMid slice"
        testID="programme-artwork-fallback-image"
        width={FALLBACK_SIZE}
      />
    </View>
  );
}

function RetryingProgrammeImage({
  imageUrl,
  priority,
  transitionMs,
}: {
  imageUrl: string;
  priority: NonNullable<ProgrammeArtworkProps["priority"]>;
  transitionMs: ProgrammeArtworkProps["transitionMs"];
}) {
  const [attempt, setAttempt] = useState(0);
  const [isWaitingToRetry, setIsWaitingToRetry] = useState(false);
  // expo-image reloads on resize, so only fade in a new URL.
  const [hasDisplayed, setHasDisplayed] = useState(false);
  const hasRetriesRemaining = attempt < RETRY_DELAYS_MS.length;

  useEffect(() => {
    if (!(isWaitingToRetry && hasRetriesRemaining)) {
      return;
    }

    const timeout = setTimeout(() => {
      setAttempt((currentAttempt) => currentAttempt + 1);
      setIsWaitingToRetry(false);
    }, RETRY_DELAYS_MS[attempt]);

    return () => clearTimeout(timeout);
  }, [attempt, hasRetriesRemaining, isWaitingToRetry]);

  const handleError = () => {
    setIsWaitingToRetry(true);
  };

  if (!isWaitingToRetry) {
    return (
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        key={attempt}
        onDisplay={() => setHasDisplayed(true)}
        onError={handleError}
        priority={priority}
        recyclingKey={imageUrl}
        source={imageUrl}
        style={StyleSheet.absoluteFill}
        testID="programme-artwork-image"
        {...(transitionMs === undefined
          ? {}
          : { transition: hasDisplayed ? 0 : transitionMs })}
      />
    );
  }

  return <ProgrammeArtworkFallback />;
}

/** Programme artwork with bounded recovery from transient loading failures. */
export function ProgrammeArtwork({
  imageUrl,
  priority = "high",
  transitionMs,
}: ProgrammeArtworkProps) {
  if (!imageUrl) {
    return <ProgrammeArtworkFallback />;
  }

  return (
    <RetryingProgrammeImage
      imageUrl={imageUrl}
      key={imageUrl}
      priority={priority}
      transitionMs={transitionMs}
    />
  );
}
