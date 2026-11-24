import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { SearchInput } from "../../src/features/search";

const withSearchBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue p-4">
    <Story />
  </View>
);

const meta = {
  title: "Features/Search/SearchInput",
  component: SearchInput,
  decorators: [withSearchBackground],
  args: {
    onChangeText: fn(),
    value: "",
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <SearchInput
        {...args}
        onChangeText={(nextValue) => {
          args.onChangeText(nextValue);
          setValue(nextValue);
        }}
        value={value}
      />
    );
  },
} satisfies Meta<typeof SearchInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Focused: Story = {
  args: {
    autoFocus: true,
  },
};

export const Populated: Story = {
  args: {
    value: "forces news",
  },
};

export const FocusedPopulated: Story = {
  args: {
    autoFocus: true,
    value:
      "British Forces Broadcasting Service documentaries and military history",
  },
};
