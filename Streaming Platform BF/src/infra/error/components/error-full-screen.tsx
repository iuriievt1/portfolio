import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenBackground, Text } from "@/components";
import { capLeading } from "@/utils/typography";
import type { ErrorActionVerb } from "../error-catalogue";
import { ensureExitAction, getErrorEntry } from "../error-catalogue";
import { useErrorLayoutVariant } from "../hooks/use-error-layout-variant";
import { ErrorCopy } from "./error-copy";

const TITLE_SIZE = 28;
const CODE_SIZE = 18;
const GAP_MESSAGE_TO_CODE = 16;
const GAP_CODE_TO_ACTIONS = 24;
const ACTION_GAP = 16;
const ACTION_HEIGHT = 45;

const tabletShared = {
  actionLabelClassName: "font-bold text-[16px] text-dark-slate-blue",
  gapTitleToMessage: 16,
  messageSize: 20,
} as const;

const layouts = {
  mobile: {
    actionLabelClassName: "font-bold text-[14px] text-dark-slate-blue",
    actionWidth: undefined,
    gapTitleToMessage: 24,
    messageSize: 14,
    sideInset: 16,
  },
  "tablet-landscape": { ...tabletShared, actionWidth: 263, sideInset: 248 },
  "tablet-portrait": { ...tabletShared, actionWidth: 174, sideInset: 42 },
} as const;

const VERTICAL_INSET = 16;

type ErrorFullScreenProps = {
  actionLabels?: Partial<Record<ErrorActionVerb, string>> | undefined;
  code: string;
  onAction: (verb: ErrorActionVerb) => void;
  supportedActions?: ErrorActionVerb[] | undefined;
};

/** Renders the standard blocking error treatment and its recovery actions. */
export function ErrorFullScreen({
  actionLabels,
  code,
  onAction,
  supportedActions,
}: ErrorFullScreenProps) {
  const insets = useSafeAreaInsets();
  const variant = useErrorLayoutVariant();
  const layout = layouts[variant];
  const entry = getErrorEntry(code);
  const actions = ensureExitAction(
    supportedActions
      ? entry.actions.filter((action) => supportedActions.includes(action.verb))
      : entry.actions,
  );

  return (
    <View className="flex-1 bg-dark-slate-blue" testID="error-full-screen">
      <ScreenBackground />

      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          flexGrow: 1,
          justifyContent: "center",
          paddingBottom: insets.bottom + VERTICAL_INSET,
          paddingHorizontal: layout.sideInset,
          paddingTop: insets.top + VERTICAL_INSET,
        }}
        showsVerticalScrollIndicator={false}
        testID="error-full-screen-scroll"
      >
        {entry.title ? (
          <Text
            className="text-center text-white"
            style={{ fontSize: TITLE_SIZE }}
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
                capLeading(TITLE_SIZE) -
                capLeading(layout.messageSize)
              : 0,
          }}
        />

        <Text
          className="text-center text-oatmeal"
          style={{
            fontSize: CODE_SIZE,
            marginTop:
              GAP_MESSAGE_TO_CODE -
              capLeading(layout.messageSize) -
              capLeading(CODE_SIZE),
          }}
          testID="error-full-screen-code"
          weight="bold"
        >
          {code}
        </Text>

        {actions.map((action, index) => (
          <Button
            className="w-full"
            key={action.verb}
            labelClassName={layout.actionLabelClassName}
            onPress={() => onAction(action.verb)}
            style={{
              height: ACTION_HEIGHT,
              marginTop:
                index === 0
                  ? GAP_CODE_TO_ACTIONS - capLeading(CODE_SIZE)
                  : ACTION_GAP,
              maxWidth: layout.actionWidth,
            }}
            testID={`error-action-${action.verb}`}
            variant="primary"
          >
            {actionLabels?.[action.verb] ?? action.label}
          </Button>
        ))}
      </ScrollView>
    </View>
  );
}
