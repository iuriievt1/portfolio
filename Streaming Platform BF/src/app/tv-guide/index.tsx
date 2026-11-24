import { useLocalSearchParams } from "expo-router";
import { FullGuideScreen } from "@/features/full-guide";

export default function TvGuideScreen() {
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();

  return <FullGuideScreen channelId={channelId} />;
}
