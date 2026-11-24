import { LOGIN_START_REASON } from "@ansora/contracts"
import { ACCOUNT_LOGIN_OUTCOME, cryptoAndKeys, isDeviceErrorCode } from "@ansora/core-mobile"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { PinSetupScreen } from "../../features/login/components/PinSetupScreen"
import { SignInScreen } from "../../features/login/components/SignInScreen"
import { startReasonOf } from "../../features/login/constants/start-reason"
import { LOGIN_PHASE, useAccountLogin } from "../../features/login/hooks/use-account-login"
import { currentPinPolicy } from "../../features/session/effective-configuration-store"
import { setSignedInLanguage } from "../../i18n/language-store"
import { ROUTE } from "../../navigation/routes"

function single(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

export default function SignIn() {
	const router = useRouter()
	const params = useLocalSearchParams<typeof ROUTE.SIGN_IN>()
	const reason = startReasonOf(single(params.reason))
	const expectedPersonalNumber = single(params.account)
	const [accountName, setAccountName] = useState<string | undefined>()
	const { phase, signIn, submitPin, reset } = useAccountLogin()

	// CAP-015-R24
	useEffect(() => setSignedInLanguage(undefined), [])

	useEffect(() => {
		if (expectedPersonalNumber === undefined) {
			return
		}
		void cryptoAndKeys()
			.pinAccount(expectedPersonalNumber)
			.then((account) => setAccountName(account?.displayName))
			.catch((failure: unknown) => console.warn("PIN account could not be read", failure))
	}, [expectedPersonalNumber])

	useEffect(() => {
		if (phase.kind === LOGIN_PHASE.SIGNED_IN) {
			router.replace(reason === LOGIN_START_REASON.FIRST_LOGIN ? ROUTE.PERMISSIONS : ROUTE.HOME)
			return
		}
		if (
			phase.kind === LOGIN_PHASE.FAILED &&
			phase.failure.kind === ACCOUNT_LOGIN_OUTCOME.REJECTED &&
			isDeviceErrorCode(phase.failure.code)
		) {
			router.replace(ROUTE.ENTRY)
		}
	}, [phase, router, reason])

	const start = useCallback(() => {
		void signIn({ reason, expectedPersonalNumber })
	}, [signIn, reason, expectedPersonalNumber])

	if (phase.kind === LOGIN_PHASE.PIN_SETUP) {
		return (
			<PinSetupScreen
				policy={currentPinPolicy()}
				replacesPin={phase.replacesPin}
				violation={phase.violation}
				verifying={phase.verifying}
				onSubmit={(pin) => void submitPin(pin)}
			/>
		)
	}
	return (
		<SignInScreen
			busy={phase.kind === LOGIN_PHASE.BUSY || phase.kind === LOGIN_PHASE.SIGNED_IN}
			failure={phase.kind === LOGIN_PHASE.FAILED ? phase.failure : undefined}
			accountName={accountName}
			onSignIn={start}
			onReset={reset}
		/>
	)
}
