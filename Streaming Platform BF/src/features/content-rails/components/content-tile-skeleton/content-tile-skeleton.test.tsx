import { render, screen } from "@testing-library/react-native";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import { TILE_VARIANT } from "@/features/content-rails/utils/tile-metrics";

describe("ContentTileSkeleton", () => {
  test("reserves the title block for square content tiles", () => {
    render(
      <ContentTileSkeleton variant={TILE_VARIANT.SQUARE_CARD} width={233} />,
    );

    expect(screen.getByTestId("content-tile-skeleton-label")).toBeTruthy();
  });

  test("omits the title block for square channel tiles", () => {
    render(
      <ContentTileSkeleton
        reservesLabelBlock={false}
        variant={TILE_VARIANT.SQUARE_CARD}
        width={233}
      />,
    );

    expect(screen.queryByTestId("content-tile-skeleton-label")).toBeNull();
  });
});
