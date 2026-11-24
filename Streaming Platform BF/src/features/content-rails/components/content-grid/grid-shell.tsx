import type { ReactNode } from "react";
import { View } from "react-native";

import { ScreenBackground } from "@/components";
import { GridHeader } from "@/features/content-rails/components/content-grid/grid-header";
import type { GridHeaderMetrics } from "@/features/content-rails/components/content-grid/grid-metrics";

interface GridShellProps {
  children: ReactNode;
  gridPadding: number;
  metrics: GridHeaderMetrics;
  onClose?: (() => void) | undefined;
  paddingTop: number;
  title?: string | undefined;
}

/** Backdrop, safe area, header. */
export function GridShell({
  children,
  gridPadding,
  metrics,
  onClose,
  paddingTop,
  title,
}: GridShellProps) {
  return (
    <View className="flex-1 bg-dark-slate-blue">
      <ScreenBackground artwork={false} />
      <View className="flex-1" style={{ paddingTop }}>
        <GridHeader
          gridPadding={gridPadding}
          metrics={metrics}
          onClose={onClose}
          title={title}
        />
        {children}
      </View>
    </View>
  );
}
