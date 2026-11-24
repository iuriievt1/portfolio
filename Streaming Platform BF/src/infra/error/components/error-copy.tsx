import type { StyleProp, TextStyle } from "react-native";

import { Text } from "@/components";
import { openExternalUrl } from "@/utils/external-url";
import type { ErrorCatalogueEntry } from "../error-catalogue";
import { DEFENCE_GATEWAY_LABEL, formatErrorCopy } from "../error-catalogue";

const DEFENCE_GATEWAY_URL = "https://www.defencegateway.mod.uk";
const LINK_TAGS = { area: "error", operation: "defence_gateway" };

type ErrorCopyProps = {
  className: string;
  entry: ErrorCatalogueEntry;
  style: StyleProp<TextStyle>;
};

/** Prints the copy, hyperlinking the Defence Gateway address when it appears. */
export function ErrorCopy({ className, entry, style }: ErrorCopyProps) {
  const copy = formatErrorCopy(entry);
  const linkStart = copy.indexOf(DEFENCE_GATEWAY_LABEL);

  if (linkStart === -1) {
    return (
      <Text className={className} style={style}>
        {copy}
      </Text>
    );
  }

  return (
    <Text className={className} style={style}>
      {copy.slice(0, linkStart)}
      <Text
        accessibilityHint={`Opens ${DEFENCE_GATEWAY_LABEL} in the browser`}
        accessibilityRole="link"
        className="underline"
        onPress={() => {
          void openExternalUrl({ tags: LINK_TAGS, url: DEFENCE_GATEWAY_URL });
        }}
        testID="error-defence-gateway-link"
      >
        {DEFENCE_GATEWAY_LABEL}
      </Text>
      {copy.slice(linkStart + DEFENCE_GATEWAY_LABEL.length)}
    </Text>
  );
}
