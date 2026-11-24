import * as Linking from "expo-linking";
import { reportError } from "@/infra/error/utils/report-error";

/** Opens a link in the system browser, reporting a platform refusal. */
export async function openExternalUrl({
  tags,
  url,
}: {
  tags: Record<string, string>;
  url: string;
}): Promise<boolean> {
  try {
    await Linking.openURL(url);

    return true;
  } catch (error) {
    reportError(error, { tags });

    return false;
  }
}
