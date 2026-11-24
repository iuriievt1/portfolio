import React from "react";
import { View, type ViewProps } from "react-native";

export const Player = {
  createPlayer: jest.fn().mockImplementation(() => {
    const bitmovinPlayer = {
      getDuration: jest.fn(),
      timeShift: jest.fn(),
    };

    return {
      player: {
        bitmovinPlayer,
        getAvailableSubtitles: jest.fn(),
        getSubtitleTrack: jest.fn(),
        load: jest.fn(),
        pause: jest.fn(),
        play: jest.fn(),
        seek: jest.fn(),
        setSubtitleTrack: jest.fn(),
      },
      // Spread viewProps so tests can fire native callbacks like onSourceError.
      PlayerView: ({
        viewProps,
        ...props
      }: ViewProps & { viewProps?: Record<string, unknown> }) =>
        React.createElement(View, { ...viewProps, ...props }),
    };
  }),
};
