import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { ErrorFullScreen } from "../../src/infra/error";

const meta = {
  title: "Error/ErrorFullScreen",
  component: ErrorFullScreen,
  args: {
    code: "NET_001",
    onAction: fn(),
  },
} satisfies Meta<typeof ErrorFullScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoConnection: Story = {};

export const DeviceNotAuthorised: Story = {
  args: { code: "AUTH_019" },
  parameters: {
    docs: {
      description: {
        story: "Blocks a signed-in device after a failed local integrity check. Used after session restoration, login, foreground return and before playback when auth.deviceIntegrity is enabled.",
      },
    },
  },
};

export const DeviceRemoved: Story = {
  args: { code: "AUTH_020" },
};

export const UnexpectedIssue: Story = {
  args: { code: "SYS_002" },
};
