import { render } from "@testing-library/react-native";
import { Button } from "@/components";

describe("<Button />", () => {
  test("keeps the primary label readable on the golden fill", () => {
    const { getByText } = render(
      <Button onPress={jest.fn()} variant="primary">
        Continue
      </Button>,
    );

    expect(getByText("Continue").props.className).toContain(
      "text-dark-slate-blue",
    );
  });

  test("still lets the caller style the label", () => {
    const { getByText } = render(
      <Button
        labelClassName="font-bold text-[16px] text-dark-slate-blue"
        onPress={jest.fn()}
        variant="primary"
      >
        Continue
      </Button>,
    );

    expect(getByText("Continue").props.className).toBe(
      "font-bold text-[16px] text-dark-slate-blue",
    );
  });

  test("falls back to the white label on the other variants", () => {
    const { getByText } = render(<Button onPress={jest.fn()}>Watch</Button>);

    expect(getByText("Watch").props.className).toContain("text-white");
  });
});
