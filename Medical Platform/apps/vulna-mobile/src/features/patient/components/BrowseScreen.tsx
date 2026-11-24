import type { ReactNode } from "react"
import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { BrandScreen } from "../../../ui/Brand"
import { Spinner } from "../../../ui/Spinner"
import { StateMessage } from "../../../ui/StateMessage"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { patientNumberOf } from "../patient-identity"
import { PatientHeader } from "./PatientHeader"

const HEADER_LINES = 1

interface Props<Content extends object> {
	title: string
	patient: Patient | undefined
	trailing?: ReactNode
	state: LoadState<Content>
	serverErrorHeading: string
	onBack: () => void
	onRetry: () => void
	children: (content: Content) => ReactNode
}

// CAP-002-R17, CAP-020-R02, CAP-013-R09, CHG-176, E29, E129
export function BrowseScreen<Content extends object>({
	title,
	patient,
	trailing,
	state,
	serverErrorHeading,
	onBack,
	onRetry,
	children,
}: Props<Content>) {
	return (
		<BrandScreen>
			<PatientHeader
				title={title}
				subtitle={patient === undefined ? undefined : patientNumberOf(patient)}
				numberOfLines={HEADER_LINES}
				trailing={trailing}
				onBack={onBack}
			/>
			<View className="flex-1 overflow-hidden rounded-t-sheet bg-background">
				{state.kind === LOAD_STATE.LOADING ? (
					<View className="flex-1 items-center justify-center">
						<Spinner />
					</View>
				) : null}
				{state.kind === LOAD_STATE.FAILED ? (
					<RemoteFailureState failure={state.failure} serverErrorHeading={serverErrorHeading} onRetry={onRetry} />
				) : null}
				{state.kind === LOAD_STATE.READY ? children(state) : null}
			</View>
		</BrandScreen>
	)
}

interface EmptyProps {
	icon: ReactNode
	heading: string
	body: string
}

// E109, E110, Vulna / Feedback / State
export function BrowseEmpty({ icon, heading, body }: EmptyProps) {
	return (
		<View className="flex-1 justify-center px-screen pb-safe-gap-or-sheet">
			<StateMessage icon={icon} heading={heading} body={body} />
		</View>
	)
}
