import React from "react";
import { View, type ViewProps } from "react-native";

// Jest can't load .svg files (that transform only runs in Metro), so we render
// a plain View instead and components with icons still mount in tests.
export default function SvgMock(props: ViewProps) {
  return React.createElement(View, props);
}
