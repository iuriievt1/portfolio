import { Animated, View } from "react-native";
import { theme } from "@/theme/theme";

const DOT_SIZE = 8;
const PILL_WIDTH = 24;
const GAP = 5;
// One card move slides the row by a dot and a gap.
const STEP = DOT_SIZE + GAP;
// 2 dots, the pill, 2 dots. The extra dot at each end slides in and out of view.
const WINDOW_WIDTH = PILL_WIDTH + DOT_SIZE * 4 + GAP * 4;
const GREY = theme.colors["grey-50"];
const WHITE = theme.colors.white;

// How far the slide has turned: -1 is the next item, 1 the previous one, 0 at rest.
const TURN_INPUT = [-1, 0, 1];
// Shape places around the pill. 0 is the pill at rest.
const SLOTS = [-3, -2, -1, 0, 1, 2, 3];

// How much each shape is the pill (1) or a dot (0) at each turn step.
function getPillSteps(slot: number) {
  return TURN_INPUT.map((turn) => Math.max(0, 1 - Math.abs(slot + turn)));
}

/** The dots that show which card is active. They slide like the design team's reference: the pill hands over to the next dot. */
export function HeroDots({
  activeCard,
  position,
}: {
  activeCard: number;
  position: Animated.Value;
}) {
  const turn = Animated.add(position, activeCard).interpolate({
    extrapolate: "clamp",
    inputRange: [-1, 1],
    outputRange: [-1, 1],
  });

  return (
    <View
      accessibilityElementsHidden
      className="mt-2 items-center"
      importantForAccessibility="no-hide-descendants"
      testID="hero-dots"
    >
      <View
        style={{ height: DOT_SIZE, overflow: "hidden", width: WINDOW_WIDTH }}
      >
        <Animated.View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: GAP,
            left: -STEP,
            position: "absolute",
            top: 0,
            transform: [
              {
                translateX: turn.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-STEP, STEP],
                }),
              },
            ],
          }}
        >
          {SLOTS.map((slot) => {
            const pillAmount = turn.interpolate({
              inputRange: TURN_INPUT,
              outputRange: getPillSteps(slot),
            });

            return (
              <Animated.View
                key={slot}
                style={{
                  backgroundColor: pillAmount.interpolate({
                    inputRange: [0, 1],
                    outputRange: [GREY, WHITE],
                  }),
                  borderRadius: DOT_SIZE / 2,
                  height: DOT_SIZE,
                  width: pillAmount.interpolate({
                    inputRange: [0, 1],
                    outputRange: [DOT_SIZE, PILL_WIDTH],
                  }),
                }}
              />
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}
