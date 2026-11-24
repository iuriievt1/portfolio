import { Stack, useRouter } from "expo-router";

import { NotFoundScreen } from "@/infra/error";

export default function NotFoundRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotFoundScreen onGoHome={() => router.replace("/")} />
    </>
  );
}
