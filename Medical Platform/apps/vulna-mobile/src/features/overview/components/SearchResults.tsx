import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { isRetryable } from "../../../api/remote-failure"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { InsetDivider } from "../../../ui/Divider"
import { FogSpacer } from "../../../ui/Fog"
import { WarningIcon } from "../../../ui/icons/WarningIcon"
import { StateMessage } from "../../../ui/StateMessage"
import { Detail } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"
import { MatchRow } from "../../identification/components/MatchRow"
import { RemoteFailureMessage } from "../../remote/components/RemoteFailureState"
import type { PatientSearch } from "../hooks/use-patient-search"
import { foundIdentifierOf, SEARCH_STATE } from "../patient-search"

// CAP-013-R07, CAP-013-R15, CAP-013-R17, CHG-182, E12, E70 to E73
export function SearchResults({ search, bottomInset }: { search: PatientSearch; bottomInset: number }) {
	const texts = useTexts()
	const { state } = search
	switch (state.kind) {
		case SEARCH_STATE.IDLE:
			return <View className="flex-1" />
		case SEARCH_STATE.TOO_SHORT:
			return (
				<View className="flex-1 px-screen pt-4">
					<Detail>{texts.search.tooShort}</Detail>
				</View>
			)
		case SEARCH_STATE.FOUND:
			return <Matches search={search} patients={state.patients} bottomInset={bottomInset} />
		case SEARCH_STATE.NOT_FOUND:
			return (
				<SearchMessage>
					<StateMessage
						icon={<WarningIcon />}
						heading={texts.search.notFound.heading}
						body={texts.search.notFound.body}
					/>
				</SearchMessage>
			)
		case SEARCH_STATE.TOO_BROAD:
			return (
				<SearchMessage>
					<StateMessage
						icon={<WarningIcon />}
						heading={texts.search.tooBroad.heading}
						body={texts.search.tooBroad.body}
					/>
				</SearchMessage>
			)
		case SEARCH_STATE.RATE_LIMITED:
			return (
				<SearchMessage>
					<StateMessage
						icon={<WarningIcon />}
						heading={texts.search.rateLimited.heading}
						body={fillText(texts.search.rateLimited.body, { n: state.retryAfterSeconds ?? 0 }, texts.language)}
					/>
					<Button label={texts.remote.retry} onPress={search.retry} disabled={!search.canRetry} />
				</SearchMessage>
			)
		case SEARCH_STATE.FAILED:
			return (
				<SearchMessage>
					<RemoteFailureMessage failure={state.failure} serverErrorHeading={texts.search.failed} />
					{isRetryable(state.failure) ? <Button label={texts.remote.retry} onPress={search.retry} /> : null}
				</SearchMessage>
			)
		default:
			return state satisfies never
	}
}

function SearchMessage({ children }: { children: ReactNode }) {
	return <View className="flex-1 gap-5 px-screen pt-8">{children}</View>
}

interface MatchesProps {
	search: PatientSearch
	patients: readonly Patient[]
	bottomInset: number
}

function Matches({ search, patients, bottomInset }: MatchesProps) {
	return (
		<ScrollView contentContainerClassName="grow pt-4" contentContainerStyle={{ paddingBottom: bottomInset }}>
			{patients.map((patient) => {
				const identifier = foundIdentifierOf(patient, search.system, search.query)
				return (
					<View key={patient.patient_id}>
						<MatchRow identifier={identifier.value} issuer={identifier.issuer} onPress={() => search.choose(patient)} />
						<InsetDivider />
					</View>
				)
			})}
			<FogSpacer />
		</ScrollView>
	)
}
