import { errorCodes } from "../error-codes";
import { useErrorAction } from "../hooks/use-error-action";
import { ErrorFullScreen } from "./error-full-screen";

interface NotFoundScreenProps {
  onGoHome: () => void;
}

export function NotFoundScreen({ onGoHome }: NotFoundScreenProps) {
  const handleAction = useErrorAction({ onCancel: onGoHome });

  return (
    <ErrorFullScreen
      code={errorCodes.unexpected}
      onAction={handleAction}
      supportedActions={["back"]}
    />
  );
}
