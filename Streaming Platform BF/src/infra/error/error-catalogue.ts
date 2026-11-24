export type ErrorPresentation = "full-page" | "inline" | "modal";

export type ErrorActionVerb =
  | "acknowledge"
  | "back"
  | "cancel"
  | "refresh"
  | "retry"
  | "signIn"
  | "updateApp";

export type ErrorAction = {
  label: string;
  verb: ErrorActionVerb;
};

export type ErrorCatalogueEntry = {
  actions: ErrorAction[];
  message: string;
  presentation: ErrorPresentation;
  title?: string;
  whatToDo?: string;
};

/** The address the copy hyperlinks. */
export const DEFENCE_GATEWAY_LABEL = "DefenceGateway.mod.uk";

const VISIT_DEFENCE_GATEWAY = `Please visit ${DEFENCE_GATEWAY_LABEL}`;
const CONTACT_BFBS = "Please contact BFBS";
const RETURN_TO_TV = "Return to your TV and request another code";

const OKAY: ErrorAction = { label: "Okay", verb: "acknowledge" };
const CANCEL: ErrorAction = { label: "Cancel", verb: "cancel" };
const SIGN_IN: ErrorAction = { label: "Sign In", verb: "signIn" };

const ACCOUNT_NOT_AUTHORISED: ErrorCatalogueEntry = {
  actions: [OKAY],
  message: "Your account is not authorised for this service.",
  presentation: "modal",
  title: "Account Not Authorised",
  whatToDo: VISIT_DEFENCE_GATEWAY,
};

const SIGN_IN_REQUIRED: ErrorCatalogueEntry = {
  actions: [SIGN_IN, CANCEL],
  message: "For security, we've signed you out",
  presentation: "modal",
  title: "Sign In Required",
  whatToDo: "Please sign in again",
};

const CANNOT_SIGN_IN: ErrorCatalogueEntry = {
  actions: [OKAY],
  message: "We can't log you in right now",
  presentation: "modal",
  title: "Something went wrong",
  whatToDo: CONTACT_BFBS,
};

const UNEXPECTED_ISSUE: ErrorCatalogueEntry = {
  actions: [
    { label: "Refresh", verb: "refresh" },
    { label: "Back", verb: "back" },
  ],
  message: "Sorry, we ran into an unexpected issue",
  presentation: "modal",
  title: "Something went wrong",
  whatToDo: "Please try again",
};

/** The BFBS Error Table. */
export const ERROR_CATALOGUE: Record<string, ErrorCatalogueEntry> = {
  AUTH_001: {
    actions: [SIGN_IN, CANCEL],
    message: "Sorry, something went wrong",
    presentation: "modal",
    title: "Something went wrong",
    whatToDo: "Please try again, if the problem persists please contact BFBS",
  },
  AUTH_002: {
    actions: [],
    message: "Incorrect username or password",
    presentation: "inline",
  },
  AUTH_003: {
    actions: [OKAY],
    message: "Your account has expired",
    presentation: "modal",
    title: "Account Expired",
    whatToDo: VISIT_DEFENCE_GATEWAY,
  },
  AUTH_004: {
    actions: [OKAY],
    message: "Your account has been suspended",
    presentation: "modal",
    title: "Account Suspended",
    whatToDo: VISIT_DEFENCE_GATEWAY,
  },
  AUTH_005: {
    actions: [OKAY],
    message: "Sponsor renewal is required for your account",
    presentation: "modal",
    title: "Sponsor Renewal Required",
    whatToDo: "Please contact your Defence Gateway account sponsor",
  },
  AUTH_006: SIGN_IN_REQUIRED,
  AUTH_007: SIGN_IN_REQUIRED,
  AUTH_008: ACCOUNT_NOT_AUTHORISED,
  AUTH_009: {
    actions: [OKAY],
    message: "Your account is locked",
    presentation: "modal",
    title: "Account temporarily locked",
    whatToDo: VISIT_DEFENCE_GATEWAY,
  },
  AUTH_010: ACCOUNT_NOT_AUTHORISED,
  AUTH_011: {
    actions: [OKAY],
    message: "Your account requires more information",
    presentation: "modal",
    title: "Account Information Required",
    whatToDo: VISIT_DEFENCE_GATEWAY,
  },
  AUTH_012: CANNOT_SIGN_IN,
  AUTH_013: CANNOT_SIGN_IN,
  AUTH_014: CANNOT_SIGN_IN,
  AUTH_015: CANNOT_SIGN_IN,
  AUTH_016: CANNOT_SIGN_IN,
  AUTH_017: {
    actions: [],
    message: "The code entered has expired",
    presentation: "inline",
    title: "Code Expired",
    whatToDo: RETURN_TO_TV,
  },
  AUTH_018: {
    actions: [],
    message: "The code entered is not recognised",
    presentation: "inline",
    title: "Code Not Recognised",
    whatToDo: RETURN_TO_TV,
  },
  AUTH_019: {
    actions: [],
    message: "The application is not authorised on this device",
    presentation: "full-page",
    title: "Device Not Authorised",
    whatToDo: "Please use another device",
  },
  AUTH_020: {
    actions: [SIGN_IN],
    message: "The application is not currently authorised on this device",
    presentation: "full-page",
    title: "App Requires Sign In",
    whatToDo: "Please re-try signing in",
  },
  AUTH_021: {
    actions: [{ label: "Manage Devices", verb: "acknowledge" }],
    message: "You've logged in on too many devices with this account",
    presentation: "modal",
    title: "Too Many Devices",
    whatToDo: "Please remove one of your devices before accessing the service",
  },
  CNT_001: {
    actions: [],
    message: "Sorry, we couldn't find anything matching your search",
    presentation: "inline",
    title: "No results found",
    whatToDo: "Try different keywords",
  },
  CNT_002: {
    // Not in the Error Table; gives watch details a way back.
    actions: [OKAY],
    message: "Sorry, the content you selected is no longer available",
    presentation: "inline",
    title: "This title has been removed",
    whatToDo: "Browse similar titles",
  },
  NET_001: {
    actions: [OKAY],
    message: "We can't connect right now",
    presentation: "modal",
    title: "No internet connection",
    whatToDo: "Please check your network connection and try again",
  },
  NET_002: {
    actions: [OKAY],
    message: "The internet speed may be too slow for video streaming",
    presentation: "modal",
    title: "The connection is unstable",
    whatToDo: "Please move closer to your router or switch networks",
  },
  NET_003: {
    actions: [{ label: "Okay", verb: "retry" }],
    message: "Our servers aren't responding right now",
    presentation: "modal",
    title: "We're having trouble connecting",
    whatToDo: "Please try again in a few minutes",
  },
  NET_004: {
    actions: [{ label: "Okay", verb: "retry" }],
    message: "The request timed out before we could complete it",
    presentation: "modal",
    title: "That took too long",
    whatToDo: "Please try again",
  },
  PLAY_001: {
    actions: [
      { label: "Retry", verb: "retry" },
      { label: "Back", verb: "back" },
    ],
    message: "We couldn't start this video",
    presentation: "modal",
    title: "Unable to Play",
    whatToDo: "Try again or choose something else",
  },
  PLAY_002: {
    actions: [OKAY],
    message: "Sorry, this title isn't available right now",
    presentation: "modal",
    title: "Content Unavailable",
    whatToDo: "Browse other titles or check back later",
  },
  PLAY_003: {
    actions: [OKAY],
    message: "Sorry, this title isn't licensed for your location",
    presentation: "modal",
    title: "Not Available in Your Region",
    whatToDo: "Explore other titles",
  },
  PLAY_004: {
    actions: [OKAY],
    message: "This device doesn't support playback for this content",
    presentation: "modal",
    title: "Device not supported",
    whatToDo: "Try another device or update your system",
  },
  PLAY_005: {
    actions: [OKAY],
    message: "We couldn't verify playback permissions",
    presentation: "modal",
    title: "Playback authorisation failed",
    whatToDo: "Restart the app and try again",
  },
  PLAY_006: {
    actions: [{ label: "Update App", verb: "updateApp" }, CANCEL],
    message: "Your device can't play this video format",
    presentation: "modal",
    title: "Format not supported",
    whatToDo: "Update your app or device software",
  },
  PLAY_007: {
    actions: [OKAY],
    message: "Your connection speed is affecting video streaming",
    presentation: "modal",
    title: "Playback interrupted",
    whatToDo: "Check your network connection",
  },
  PLAY_008: {
    actions: [{ label: "Close", verb: "back" }],
    message:
      "You're trying to watch on too many of your devices at the same time",
    presentation: "modal",
    title: "Stream Limit",
    whatToDo: "Stop streaming on an other device linked to your account",
  },
  SYS_001: {
    actions: [{ label: "Update App", verb: "updateApp" }],
    message: "A newer version of the app is available",
    presentation: "modal",
    title: "Update required",
    whatToDo: "Update the app to continue",
  },
  SYS_002: UNEXPECTED_ISSUE,
  SYS_003: {
    actions: [{ label: "OK", verb: "acknowledge" }],
    message: "We're currently performing maintenance",
    presentation: "modal",
    title: "We'll be back soon",
    whatToDo: "Please check back shortly",
  },
};

const BACK: ErrorAction = { label: "Back", verb: "back" };
const EXIT_VERBS: ErrorActionVerb[] = [
  "acknowledge",
  "back",
  "cancel",
  "signIn",
];

/**
 * A dialog with nothing usable behind it needs one action that leaves. An entry
 * with no actions at all withholds them on purpose and keeps none.
 */
export function ensureExitAction(actions: ErrorAction[]): ErrorAction[] {
  const hasExit =
    actions.length === 0 ||
    actions.some((action) => EXIT_VERBS.includes(action.verb));

  return hasExit ? actions : [...actions, BACK];
}

/** Joins message and advice. */
export function formatErrorCopy({
  message,
  whatToDo,
}: ErrorCatalogueEntry): string {
  if (!whatToDo) {
    return message;
  }

  const separator = message.endsWith(".") ? " " : ". ";

  return `${message}${separator}${whatToDo}.`;
}

/** Unknown codes fall back to SYS_002. */
export function getErrorEntry(code: string): ErrorCatalogueEntry {
  return ERROR_CATALOGUE[code] ?? UNEXPECTED_ISSUE;
}
