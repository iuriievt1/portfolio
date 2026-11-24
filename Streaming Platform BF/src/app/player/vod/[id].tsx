import { useLocalSearchParams, useRouter } from "expo-router";
import { type VodAsset, VodPlayer } from "@/features/video-player";
import { ErrorFullScreen, errorCodes, useErrorAction } from "@/infra/error";

export default function VodPlayerScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

  const asset: VodAsset | null = id ? { id, title: title ?? id } : null;

  const handleClose = () => {
    router.back();
  };

  const handleMissingAssetAction = useErrorAction({ onCancel: handleClose });

  if (!asset) {
    return (
      <ErrorFullScreen
        code={errorCodes.contentUnavailable}
        onAction={handleMissingAssetAction}
      />
    );
  }

  return <VodPlayer asset={asset} onClose={handleClose} />;
}
