import { act, fireEvent, render } from "@testing-library/react-native";
import { ProgrammeArtwork } from "@/components/programme-artwork";

jest.mock("expo-image", () => ({ Image: require("react-native").View }));

const IMAGE_URL = "https://example.com/programme.jpg";

describe("ProgrammeArtwork", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries transient image failures", () => {
    const { getByTestId, queryByTestId } = render(
      <ProgrammeArtwork imageUrl={IMAGE_URL} />,
    );

    fireEvent(getByTestId("programme-artwork-image"), "error");
    expect(getByTestId("programme-artwork-fallback")).toBeTruthy();

    act(() => jest.advanceTimersByTime(1000));

    expect(getByTestId("programme-artwork-image")).toBeTruthy();
    expect(queryByTestId("programme-artwork-fallback")).toBeNull();
  });

  it("settles on the fallback after retries are exhausted", () => {
    const { getByTestId, queryByTestId } = render(
      <ProgrammeArtwork imageUrl={IMAGE_URL} />,
    );

    fireEvent(getByTestId("programme-artwork-image"), "error");
    act(() => jest.advanceTimersByTime(1000));
    fireEvent(getByTestId("programme-artwork-image"), "error");
    act(() => jest.advanceTimersByTime(3000));
    fireEvent(getByTestId("programme-artwork-image"), "error");

    expect(getByTestId("programme-artwork-fallback")).toBeTruthy();
    act(() => jest.runOnlyPendingTimers());
    expect(queryByTestId("programme-artwork-image")).toBeNull();
  });

  it("starts fresh when the image URL changes", () => {
    const { getByTestId, rerender } = render(
      <ProgrammeArtwork imageUrl={IMAGE_URL} />,
    );

    fireEvent(getByTestId("programme-artwork-image"), "error");
    rerender(
      <ProgrammeArtwork imageUrl="https://example.com/replacement.jpg" />,
    );

    expect(getByTestId("programme-artwork-image")).toBeTruthy();
  });

  it("replaces the fallback when artwork arrives later", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <ProgrammeArtwork imageUrl={undefined} />,
    );

    getByTestId("programme-artwork-fallback");
    rerender(<ProgrammeArtwork imageUrl={IMAGE_URL} />);

    expect(getByTestId("programme-artwork-image").props.recyclingKey).toBe(
      IMAGE_URL,
    );
    expect(queryByTestId("programme-artwork-fallback")).toBeNull();
  });
});
