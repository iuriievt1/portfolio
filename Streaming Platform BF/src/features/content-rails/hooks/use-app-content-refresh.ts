import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  type AppSectionRoute,
  appContentQueryOptions,
} from "@/features/content-rails/app-content";
import { reportError } from "@/infra/error";

/** Checks the shared catalogue query whenever a catalogue-backed page becomes active. */
export function useAppContentRefresh(route: AppSectionRoute) {
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      void queryClient.fetchQuery(appContentQueryOptions).catch((error) => {
        reportError(error, {
          tags: {
            area: "content_rails",
            operation: "refresh_app_content_on_navigation",
            route,
          },
        });
      });
    }, [queryClient, route]),
  );
}
