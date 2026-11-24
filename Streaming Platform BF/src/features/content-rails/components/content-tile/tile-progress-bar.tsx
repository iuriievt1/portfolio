import { View } from "react-native";
import {
  BOTTOM_SCRIM_COLOURS,
  TileScrim,
} from "@/features/content-rails/components/content-tile/tile-scrim";

export function TileProgressBar({ progress }: { progress: number }) {
  return (
    <>
      <TileScrim colours={BOTTOM_SCRIM_COLOURS} edge="bottom" />
      <View
        className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-transparent-white-50"
        pointerEvents="none"
        testID="content-tile-progress"
      >
        <View
          className="h-full rounded-full bg-white"
          style={{
            width: `${progress * 100}%`,
          }}
        />
      </View>
    </>
  );
}
