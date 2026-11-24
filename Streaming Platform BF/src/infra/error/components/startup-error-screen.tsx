import { useErrorAction } from "../hooks/use-error-action";
import { mapLoadErrorToCode } from "../map-load-error";
import { ErrorFullScreen } from "./error-full-screen";

interface StartupErrorScreenProps {
  error: unknown;
  onRetry: () => void;
}

export function StartupErrorScreen({
  error,
  onRetry,
}: StartupErrorScreenProps) {
  const handleAction = useErrorAction({ onCancel: onRetry, onRetry });

  return (
    <ErrorFullScreen
      code={mapLoadErrorToCode(error)}
      onAction={handleAction}
      supportedActions={["acknowledge", "refresh"]}
    />
  );
}
