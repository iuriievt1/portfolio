import { fireEvent, render } from "@testing-library/react-native";
import { Keyboard } from "react-native";

import { SearchInput } from "@/features/search";

describe("SearchInput", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders its controlled value and reports text changes", () => {
    const onChangeText = jest.fn();
    const { getByTestId, rerender } = render(
      <SearchInput onChangeText={onChangeText} value="" />,
    );

    const input = getByTestId("search-input");
    fireEvent.changeText(input, "news");

    expect(onChangeText).toHaveBeenCalledWith("news");

    rerender(<SearchInput onChangeText={onChangeText} value="news" />);
    expect(getByTestId("search-input")).toHaveProp("value", "news");
  });

  it("uses the native text keyboard without automatic text changes", () => {
    const { getByTestId } = render(
      <SearchInput onChangeText={jest.fn()} value="" />,
    );

    expect(getByTestId("search-input")).toHaveProp("autoCapitalize", "none");
    expect(getByTestId("search-input")).toHaveProp("autoCorrect", false);
    expect(getByTestId("search-input")).toHaveProp("returnKeyType", "search");
  });

  it("reports individual character deletion, including an empty query", () => {
    const onChangeText = jest.fn();
    const { getByTestId, rerender } = render(
      <SearchInput onChangeText={onChangeText} value="news" />,
    );

    fireEvent.changeText(getByTestId("search-input"), "new");
    rerender(<SearchInput onChangeText={onChangeText} value="new" />);
    fireEvent.changeText(getByTestId("search-input"), "");

    expect(onChangeText).toHaveBeenNthCalledWith(1, "new");
    expect(onChangeText).toHaveBeenNthCalledWith(2, "");
  });

  it("dismisses the keyboard and submits the controlled query once", () => {
    const dismissKeyboard = jest
      .spyOn(Keyboard, "dismiss")
      .mockImplementation(() => {});
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <SearchInput
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        value="forces news"
      />,
    );

    fireEvent(getByTestId("search-input"), "submitEditing");

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("forces news");
    expect(getByTestId("search-input")).toHaveProp("value", "forces news");
  });

  it("updates its focus treatment and forwards focus events", () => {
    const onBlur = jest.fn();
    const onFocus = jest.fn();
    const { getByTestId } = render(
      <SearchInput
        onBlur={onBlur}
        onChangeText={jest.fn()}
        onFocus={onFocus}
        value=""
      />,
    );
    const input = getByTestId("search-input");
    const surface = getByTestId("search-input-surface");

    expect(surface).toHaveProp(
      "className",
      expect.stringContaining("border-transparent-white-50"),
    );

    fireEvent(input, "focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(surface).toHaveProp(
      "className",
      expect.stringContaining("border-golden-yellow"),
    );

    fireEvent(input, "blur");
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(surface).toHaveProp(
      "className",
      expect.stringContaining("border-transparent-white-50"),
    );
  });

  it("truncates from the end while blurred and moves the caret to the end on focus", () => {
    const value = "A search query that is too long to fit in the field";
    const { getByTestId, queryByTestId } = render(
      <SearchInput onChangeText={jest.fn()} value={value} />,
    );

    expect(getByTestId("search-input-collapsed-value")).toHaveProp(
      "ellipsizeMode",
      "tail",
    );
    expect(getByTestId("search-input-collapsed-value")).toHaveProp(
      "numberOfLines",
      1,
    );

    fireEvent(getByTestId("search-input"), "focus");

    expect(queryByTestId("search-input-collapsed-value")).toBeNull();
    expect(getByTestId("search-input")).toHaveProp("selection", {
      end: value.length,
      start: value.length,
    });
  });

  it("exposes search semantics and the current value", () => {
    const { getByLabelText } = render(
      <SearchInput onChangeText={jest.fn()} value="forces news" />,
    );

    expect(getByLabelText("Search")).toHaveProp("accessibilityRole", "search");
    expect(getByLabelText("Search")).toHaveProp("accessibilityValue", {
      text: "forces news",
    });
  });

  it("clears the value", () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <SearchInput onChangeText={onChangeText} value="forces news" />,
    );

    fireEvent.press(getByTestId("search-input-clear"));

    expect(onChangeText).toHaveBeenCalledWith("");
    expect(getByTestId("search-input-clear")).toHaveStyle({ minHeight: 44 });
  });
});
