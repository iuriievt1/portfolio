import type { ContentItem } from "@bfbs/common-sdk";
import { act, renderHook } from "@testing-library/react-native";
import type { GuideChannel } from "@/features/full-guide";
import { useGuideSelection } from "@/features/full-guide";
import { HOUR_MS } from "@/utils/date-time";

const NOW_MS = new Date(2026, 8, 3, 12, 0).getTime();

function cell(id: string, fromNowHours: number) {
  const startMs = NOW_MS + fromNowHours * HOUR_MS;

  return {
    endMs: startMs + HOUR_MS,
    id,
    programme: {
      contentType: "programme",
      id,
      startDateTime: new Date(startMs).toISOString(),
      title: id,
    } as ContentItem,
    startMs,
  };
}

function channel(id: string, cells: GuideChannel["cells"]): GuideChannel {
  return { cells, id, logoUrl: undefined, name: id };
}

const sport = channel("sport", [cell("sky-sports-news", 0)]);
const extra = channel("extra", [
  cell("my-name-is-earl", 0),
  cell("tomorrow", 12),
]);

function renderSelection(channels: GuideChannel[]) {
  return renderHook(
    (props: { channels: GuideChannel[] }) =>
      useGuideSelection({ channels: props.channels, nowMs: NOW_MS }),
    { initialProps: { channels } },
  );
}

describe("useGuideSelection", () => {
  test("opens on what is live before the viewer picks anything", () => {
    const { result } = renderSelection([sport, extra]);

    expect(result.current.selection?.cell.id).toBe("sky-sports-news");
  });

  test("keeps the viewer's pick when its day leaves the loaded window", () => {
    const { rerender, result } = renderSelection([sport, extra]);

    act(() => {
      result.current.selectCell("tomorrow");
    });

    expect(result.current.selection?.channel.id).toBe("extra");

    rerender({ channels: [sport, channel("extra", [])] });

    expect(result.current.selection?.cell.id).toBe("tomorrow");
    expect(result.current.selection?.channel.id).toBe("extra");
  });

  test("follows the pick's fresh data once its day is loaded again", () => {
    const { rerender, result } = renderSelection([sport, extra]);

    act(() => {
      result.current.selectCell("tomorrow");
    });

    rerender({ channels: [sport, channel("extra", [])] });
    rerender({ channels: [sport, extra] });

    expect(result.current.selection?.cell).toBe(extra.cells[1]);
  });
});
