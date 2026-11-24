import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { TextField } from "../../src/components";

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue p-4">
    <Story />
  </View>
);

const meta = {
  title: "Components/TextField",
  component: TextField,
  decorators: [withDarkBackground],
  args: {
    placeholder: "Username or Service/Staff Number",
  },
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: {
    value: "Username1",
  },
};

export const Bare: Story = {
  args: {
    placeholder: "Borderless field",
    surface: "bare",
  },
};

export const Password: Story = {
  args: {
    placeholder: "Password",
    secureTextEntry: true,
    value: "123456789qwerty",
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    value: "Username1",
  },
};
