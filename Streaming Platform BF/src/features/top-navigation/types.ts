import type { AppSectionRoute } from "@/features/content-rails/app-content";

export interface TopNavigationItem {
  id: string;
  label: string;
  path: AppSectionRoute;
}
