import { Auth } from "@bfbs/common-sdk";
import { DevSettings } from "react-native";

import { Button } from "@/components";
import { reportError } from "@/infra/error";

function signOutAndReload() {
  void Auth.signOut()
    .then(() => DevSettings.reload())
    .catch(reportError);
}

/** Dev-only session reset. */
export function DevSignOutButton() {
  if (!__DEV__) {
    return null;
  }

  return (
    <Button
      className="mb-4 self-center"
      labelClassName="text-[14px] text-white"
      onPress={signOutAndReload}
      testID="dev-sign-out"
    >
      Sign out
    </Button>
  );
}
