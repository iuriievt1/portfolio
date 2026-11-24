import { View } from "react-native"
import { isRetryable, REMOTE_FAILURE, type RemoteFailure } from "../../../api/remote-failure"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { WarningIcon } from "../../../ui/icons/WarningIcon"
import { WifiSlashIcon } from "../../../ui/icons/WifiSlashIcon"
import { StateMessage } from "../../../ui/StateMessage"
import { remoteFailureTextOf } from "../remote-failure-text"

interface MessageProps {
	failure: RemoteFailure
	serverErrorHeading: string
}

// CAP-002-R17, ADR-054, E29
export function RemoteFailureState({ failure, serverErrorHeading, onRetry }: MessageProps & { onRetry: () => void }) {
	const texts = useTexts().remote
	return (
		<View className="flex-1 justify-center gap-5 px-screen">
			<RemoteFailureMessage failure={failure} serverErrorHeading={serverErrorHeading} />
			{isRetryable(failure) ? <Button label={texts.retry} onPress={onRetry} /> : null}
		</View>
	)
}

export function RemoteFailureMessage({ failure, serverErrorHeading }: MessageProps) {
	const { heading, body } = remoteFailureTextOf(failure, serverErrorHeading, useTexts())
	const icon = failure === REMOTE_FAILURE.NO_CONNECTION ? <WifiSlashIcon /> : <WarningIcon />
	return <StateMessage icon={icon} heading={heading} body={body} />
}
