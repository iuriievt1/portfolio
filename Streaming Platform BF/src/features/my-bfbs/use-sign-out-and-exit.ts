import { useRouter } from "expo-router";
// Not the auth barrel: the auth gate imports My BFBS, so that would loop.
import { useAuthSession } from "@/features/auth/auth-session-context";
import {
  dismissErrorModal,
  errorCodes,
  formatErrorCopy,
  getErrorEntry,
  reportError,
} from "@/infra/error";
import { setMyBfbsMenuOpen } from "./my-bfbs-menu-store";

/**
 * Signs out, closes the My BFBS menu and goes to Login.
 * If sign-out fails, it resolves with the error to show instead.
 */
export function useSignOutAndExit() {
  const router = useRouter();
  const { signOut } = useAuthSession();

  return async (): Promise<string | undefined> => {
    try {
      await signOut();
    } catch (error) {
      reportError(error, { tags: { area: "auth", operation: "sign_out" } });
      return formatErrorCopy(getErrorEntry(errorCodes.unexpected));
    }

    dismissErrorModal();
    setMyBfbsMenuOpen(false);
    router.replace("/");
    return undefined;
  };
}
