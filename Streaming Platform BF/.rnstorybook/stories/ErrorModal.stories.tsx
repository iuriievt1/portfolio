import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { ErrorModal } from "../../src/infra/error";

const meta = {
  title: "Error/ErrorModal",
  component: ErrorModal,
  args: {
    code: "PLAY_006",
    onAction: fn(),
  },
} satisfies Meta<typeof ErrorModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoActions: Story = {};

export const SingleAction: Story = {
  args: { code: "PLAY_002" },
};

export const SignInRequired: Story = {
  args: { code: "AUTH_006" },
};

export const TooManyDevices: Story = {
  args: { code: "AUTH_021" },
};
