import { formatVodEpisodeMetadata } from "@/features/video-player/utils/vod-metadata";

describe("formatVodEpisodeMetadata", () => {
  test("formats complete series metadata", () => {
    expect(
      formatVodEpisodeMetadata({
        episodeNumber: "1",
        episodeTitle: "Episode Title",
        seasonNumber: "1",
      }),
    ).toBe("S1 E1 : Episode Title");
  });

  test.each([
    [{ episodeTitle: "Episode Title" }, "Episode Title"],
    [
      { episodeNumber: "2", episodeTitle: "Episode Title" },
      "E2 : Episode Title",
    ],
    [
      { episodeTitle: "Episode Title", seasonNumber: "1" },
      "S1 : Episode Title",
    ],
  ])("collapses around missing fields", (metadata, expected) => {
    expect(formatVodEpisodeMetadata(metadata)).toBe(expected);
  });

  test("omits the line when every field is missing or blank", () => {
    expect(
      formatVodEpisodeMetadata({
        episodeNumber: " ",
        episodeTitle: undefined,
        seasonNumber: "",
      }),
    ).toBeUndefined();
  });
});
