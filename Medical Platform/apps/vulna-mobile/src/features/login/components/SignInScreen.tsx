import { ERROR_CODE } from "@ansora/contracts"
import { ACCOUNT_LOGIN_OUTCOME, type AuthorizationEndpointMismatchDetails } from "@ansora/core-mobile"
import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { EntryScreen } from "../../../ui/EntryScreen"
import { Detail, Label } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"
import { DeviceApprovedScreen } from "../../device/components/DeviceApprovedScreen"
import type { LoginFailure } from "../hooks/use-account-login"

interface Props {
	busy: boolean
	failure: LoginFailure | undefined
	accountName?: string
	onSignIn: () => void
	onReset: () => void
}

type ErrorTexts = { heading: string; body: string }

type SignInErrors = Texts["signIn"]["errors"]

// CAP-015-R27
const REJECTION_TEXTS: Partial<Record<string, keyof SignInErrors>> = {
	[ERROR_CODE.LOGIN_FAILED]: "loginFailed",
	[ERROR_CODE.ACCOUNT_INACTIVE]: "accountInactive",
	[ERROR_CODE.LOGIN_INCOMPLETE]: "incomplete",
	[ERROR_CODE.COMPLETION_CODE_INVALID]: "completionInvalid",
	[ERROR_CODE.LOGIN_DEVICE_MISMATCH]: "deviceMismatch",
	[ERROR_CODE.LOGIN_AUTHENTICATION_STALE]: "stale",
	[ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING]: "personalNumberMissing",
}

const RESTART_CODES: ReadonlySet<string> = new Set([
	ERROR_CODE.LOGIN_INCOMPLETE,
	ERROR_CODE.COMPLETION_CODE_INVALID,
	ERROR_CODE.LOGIN_DEVICE_MISMATCH,
	ERROR_CODE.LOGIN_AUTHENTICATION_STALE,
])

export function SignInScreen({ busy, failure, accountName, onSignIn, onReset }: Props) {
	const strings = useTexts()
	const texts = strings.signIn
	if (busy) {
		return <DeviceApprovedScreen onSignIn={onSignIn} waiting />
	}
	if (failure === undefined) {
		return <DeviceApprovedScreen onSignIn={onSignIn} />
	}
	switch (failure.kind) {
		case ACCOUNT_LOGIN_OUTCOME.CANCELLED:
			return <DeviceApprovedScreen onSignIn={onSignIn} />
		case ACCOUNT_LOGIN_OUTCOME.NO_CONNECTION:
			return <Failed texts={texts.errors.noConnection} action={{ label: texts.retry, onPress: onSignIn }} />
		case ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE:
			return <Failed texts={texts.errors.providerUnavailable} action={{ label: texts.retry, onPress: onSignIn }} />
		case ACCOUNT_LOGIN_OUTCOME.AUTHORIZATION_MISMATCH:
			return <AuthorizationMismatch details={failure.details} />
		case ACCOUNT_LOGIN_OUTCOME.REJECTED: {
			const label = RESTART_CODES.has(failure.code) ? texts.restart : texts.back
			return <Failed texts={rejectionTexts(strings, failure.code, accountName)} action={{ label, onPress: onReset }} />
		}
		default:
			return failure satisfies never
	}
}

function rejectionTexts(strings: Texts, code: string, accountName: string | undefined): ErrorTexts {
	const texts = strings.signIn.errors
	if (code === ERROR_CODE.LOGIN_IDENTITY_MISMATCH) {
		return accountName === undefined
			? texts.loginFailed
			: {
					heading: texts.identityMismatch.heading,
					body: fillText(texts.identityMismatch.body, { name: accountName }, strings.language),
				}
	}
	const key = REJECTION_TEXTS[code]
	return key === undefined ? texts.loginFailed : texts[key]
}

function Failed({ texts, action }: { texts: ErrorTexts; action: { label: string; onPress: () => void } }) {
	return <EntryScreen heading={texts.heading} body={texts.body} action={action} />
}

function AuthorizationMismatch({ details }: { details: AuthorizationEndpointMismatchDetails }) {
	const texts = useTexts().signIn.errors.authorizationMismatch
	return (
		<EntryScreen heading={texts.heading} body={texts.body}>
			<View className="gap-2 pt-6">
				<Label>{texts.forIt}</Label>
				<Detail>{`${texts.serverEndpoint}: ${details.server_authorization_endpoint}`}</Detail>
				<Detail>
					{`${texts.providerEndpoint}: ${details.provider_authorization_endpoint ?? texts.providerIssuerMismatch}`}
				</Detail>
				<Detail>{`${texts.discoveryUrl}: ${details.discovery_url}`}</Detail>
			</View>
		</EntryScreen>
	)
}
