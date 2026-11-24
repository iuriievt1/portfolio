import { StatusBar } from "expo-status-bar"
import type { ReactNode } from "react"
import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { StepHeader } from "./StepHeader"

interface Props<Content extends object> {
	title: string
	patient: Patient
	state: LoadState<Content>
	serverErrorHeading: string
	skeleton: ReactNode
	leading?: ReactNode
	onRetry: () => void
	onBack: (() => void) | undefined
	children: (content: Content) => ReactNode
}

// CAP-015-R31, CAP-002-R17, Figma 05 A, stavy-a-mikrocopy.md 4
export function StepScreen<Content extends object>({
	title,
	patient,
	state,
	serverErrorHeading,
	skeleton,
	leading,
	onRetry,
	onBack,
	children,
}: Props<Content>) {
	return (
		<View className="flex-1 bg-background">
			<StatusBar style="light" />
			<StepHeader title={title} patient={patient} leading={leading} onBack={onBack} />
			{state.kind === LOAD_STATE.LOADING ? skeleton : null}
			{state.kind === LOAD_STATE.FAILED ? (
				<RemoteFailureState failure={state.failure} serverErrorHeading={serverErrorHeading} onRetry={onRetry} />
			) : null}
			{state.kind === LOAD_STATE.READY ? children(state) : null}
		</View>
	)
}
