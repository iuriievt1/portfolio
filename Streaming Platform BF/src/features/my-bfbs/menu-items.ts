export const MENU_ITEMS = [
  "Help",
  "Continue Watching",
  "My List",
  "Time Zone",
  "Devices",
  "Terms & Conditions",
  "Privacy Policy",
] as const;

export type MenuItem = (typeof MENU_ITEMS)[number];

// Page name for the URL, e.g. "Terms & Conditions" -> "terms-conditions".
export function getPageName(item: string) {
  return item.toLowerCase().replace(/ & | /g, "-");
}

// Menu item for a page name, e.g. "terms-conditions" -> "Terms & Conditions".
export function getMenuItem(page: string) {
  return MENU_ITEMS.find((item) => getPageName(item) === page);
}
