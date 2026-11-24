import { View } from "react-native";

import { Button, Text } from "@/components";
import { capLeading } from "@/utils/typography";
import type { ErrorAction, ErrorActionVerb } from "../error-catalogue";
import { ensureExitAction, getErrorEntry } from "../error-catalogue";
import { useErrorLayoutVariant } from "../hooks/use-error-layout-variant";
import { ErrorCopy } from "./error-copy";

const CARD_RADIUS = 8;
const SCREEN_PADDING = 16;
const ACTION_GAP = 8;
const ACTION_HEIGHT = 45;
const GAP_MESSAGE_TO_CODE = 16;
const GAP_CODE_TO_ACTIONS = 16;

const ACTION_LABEL_COLOUR = {
  primary: "text-dark-slate-blue",
  transparent: "text-white",
} as const;

const tabletShared = {
  actionInset: 145,
  actionLabelClassName: "font-bold text-[16px]",
  cardWidth: 646,
  codeSize: 20,
  gapTitleToMessage: 24,
  messageInset: 55,
  messageSize: 20,
  paddingBottom: 90,
  paddingTop: 89,
  titleSize: 28,
} as const;

const layouts = {
  mobile: {
    actionInset: 44.5,
    actionLabelClassName: "font-bold text-[14px]",
    cardWidth: 343,
    codeSize: 16,
    gapTitleToMessage: 16,
    messageInset: 26,
    messageSize: 14,
    paddingBottom: 34,
    paddingTop: 33,
    titleSize: 18,
  },
  "tablet-landscape": { ...tabletShared, actionInset: 56 },
  "tablet-portrait": tabletShared,
} as const;

type ErrorModalProps = {
  code: string;
  onAction: (verb: ErrorActionVerb) => void;
  /** Set where nothing behind the dialog can dismiss it. */
  withExitAction?: boolean;
};

export function ErrorModal({
  code,
  onAction,
  withExitAction = false,
}: ErrorModalProps) {
  const variant = useErrorLayoutVariant();
  const layout = layouts[variant];
  const entry = getErrorEntry(code);
  const actions = withExitAction
    ? ensureExitAction(entry.actions)
    : entry.actions;
  const firstTextSize = entry.title ? layout.titleSize : layout.messageSize;

  const renderAction = (action: ErrorAction, index: number) => {
    const actionVariant = index === 0 ? "primary" : "transparent";

    return (
      <Button
        className="flex-1"
        key={action.verb}
        labelClassName={`${layout.actionLabelClassName} ${ACTION_LABEL_COLOUR[actionVariant]}`}
        onPress={() => onAction(action.verb)}
        style={{ height: ACTION_HEIGHT }}
        testID={`error-action-${action.verb}`}
        variant={actionVariant}
      >
        {action.label}
      </Button>
    );
  };

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-black/90"
      style={{ paddingHorizontal: SCREEN_PADDING }}
      testID="error-modal"
    >
      <View
        className="w-full items-center bg-medium-slate-blue/70"
        testID="error-modal-card"
        style={{
          borderRadius: CARD_RADIUS,
          maxWidth: layout.cardWidth,
          paddingBottom: layout.paddingBottom,
          paddingTop: layout.paddingTop - capLeading(firstTextSize),
        }}
      >
        {entry.title ? (
          <Text
            className="text-center text-white"
            style={{ fontSize: layout.titleSize }}
            weight="bold"
          >
            {entry.title}
          </Text>
        ) : null}

        <ErrorCopy
          className="text-center text-oatmeal"
          entry={entry}
          style={{
            fontSize: layout.messageSize,
            marginTop: entry.title
              ? layout.gapTitleToMessage -
                capLeading(layout.titleSize) -
                capLeading(layout.messageSize)
              : 0,
            paddingHorizontal: layout.messageInset,
          }}
        />

        <Text
          className="text-center text-white"
          style={{
            fontSize: layout.codeSize,
            marginTop:
              GAP_MESSAGE_TO_CODE -
              capLeading(layout.messageSize) -
              capLeading(layout.codeSize),
          }}
          testID="error-modal-code"
          weight="bold"
        >
          Error code: {code}
        </Text>

        {actions.length > 0 ? (
          <View
            className="w-full flex-row"
            style={{
              gap: ACTION_GAP,
              marginTop: GAP_CODE_TO_ACTIONS - capLeading(layout.codeSize),
              paddingHorizontal: layout.actionInset,
            }}
            testID="error-modal-actions"
          >
            {actions.map(renderAction)}
          </View>
        ) : null}
      </View>
    </View>
  );
}
