import { View } from "react-native";

import { Text } from "@/components";
import {
  GENRE_BOTTOM_SCRIM_COLOURS,
  GENRE_TOP_SCRIM_COLOURS,
  TileScrim,
} from "@/features/content-rails/components/content-tile/tile-scrim";

const GENRE_TITLE_BOTTOM = 13;
const GENRE_TITLE_HORIZONTAL_INSET = 8;

/** Renders the Figma genre-card scrims and artwork title. */
export function GenreOverlay({ title }: { title: string }) {
  return (
    <>
      <TileScrim colours={GENRE_TOP_SCRIM_COLOURS} edge="top" />
      <TileScrim colours={GENRE_BOTTOM_SCRIM_COLOURS} edge="bottom" />
      <View
        className="absolute items-center justify-center px-[6px]"
        pointerEvents="none"
        style={{
          bottom: GENRE_TITLE_BOTTOM,
          left: GENRE_TITLE_HORIZONTAL_INSET,
          right: GENRE_TITLE_HORIZONTAL_INSET,
        }}
      >
        <Text
          className="text-center text-[13px] uppercase tracking-[1.3px] text-white"
          numberOfLines={2}
          testID="genre-tile-title"
          weight="bold"
        >
          {title}
        </Text>
      </View>
    </>
  );
}
