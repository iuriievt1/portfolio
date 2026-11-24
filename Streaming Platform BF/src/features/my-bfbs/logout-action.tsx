import { useRef, useState } from "react";
import { Pressable } from "react-native";

import LogOutIcon from "@/assets/icons/logout-icon.svg";
import { Button, Text } from "@/components";
import { theme } from "@/theme/theme";
import { LogoutConfirmationModal } from "./logout-confirmation-modal";
import { useSignOutAndExit } from "./use-sign-out-and-exit";

type LogoutActionProps = {
  variant: "mobile" | "tablet";
};

/** Presents and completes logout from either My BFBS menu layout. */
export function LogoutAction({ variant }: LogoutActionProps) {
  const signOutAndExit = useSignOutAndExit();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);

  const closeConfirmation = () => {
    if (!isSubmittingRef.current) {
      setErrorMessage(undefined);
      setIsConfirmationOpen(false);
    }
  };

  const confirmLogout = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsPending(true);
    setErrorMessage(undefined);

    const signOutError = await signOutAndExit();

    if (signOutError) {
      setErrorMessage(signOutError);
      isSubmittingRef.current = false;
      setIsPending(false);
    }
  };

  const action =
    variant === "mobile" ? (
      <Button
        accessibilityLabel="Log out"
        className="h-[45px] flex-row gap-2 rounded-full bg-transparent-white-10"
        onPress={() => setIsConfirmationOpen(true)}
        testID="logout-action"
        variant="icon"
      >
        <LogOutIcon color={theme.colors.white} height={20} width={20} />
        <Text className="font-euclid-bold text-[16px] text-white">Log Out</Text>
      </Button>
    ) : (
      <Pressable
        accessibilityLabel="Log out"
        accessibilityRole="button"
        className="min-h-[48px] flex-row items-center gap-[8px] px-[32px]"
        onPress={() => setIsConfirmationOpen(true)}
        testID="logout-action"
      >
        <LogOutIcon color={theme.colors.white} height={20} width={20} />
        <Text className="font-euclid-bold text-[18px] text-white">Log Out</Text>
      </Pressable>
    );

  return (
    <>
      {action}
      <LogoutConfirmationModal
        errorMessage={errorMessage}
        isPending={isPending}
        onCancel={closeConfirmation}
        onConfirm={() => void confirmLogout()}
        visible={isConfirmationOpen}
      />
    </>
  );
}
