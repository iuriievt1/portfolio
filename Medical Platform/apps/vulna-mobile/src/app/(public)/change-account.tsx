import { LOGIN_START_REASON } from "@ansora/contracts"
import { cryptoAndKeys } from "@ansora/core-mobile"
import { Stack, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ChangeAccountScreen } from "../../features/unlock/components/ChangeAccountScreen"
import { selectUnlockAccount } from "../../features/unlock/selected-account-store"
import { useTexts } from "../../i18n/language-store"
import { ROUTE } from "../../navigation/routes"
import { SheetCloseButton } from "../../ui/SheetCloseButton"

export default function ChangeAccount() {
	const strings = useTexts()
	const router = useRouter()
	const [number, setNumber] = useState("")
	const [unknown, setUnknown] = useState(false)

	const changeNumber = useCallback((entered: string) => {
		setNumber(entered)
		setUnknown(false)
	}, [])

	const recognise = useCallback(async () => {
		if (number.length === 0) {
			return
		}
		const account = await cryptoAndKeys().pinAccount(number)
		if (account === null) {
			setUnknown(true)
			return
		}
		selectUnlockAccount({ personalNumber: number, displayName: account.displayName })
		router.back()
	}, [number, router])

	const signInWithAccount = useCallback(() => {
		router.replace({ pathname: ROUTE.SIGN_IN, params: { reason: LOGIN_START_REASON.UNLOCK } })
	}, [router])

	return (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.View hidesSharedBackground>
					<SheetCloseButton label={strings.unlock.account.close} onPress={() => router.back()} />
				</Stack.Toolbar.View>
			</Stack.Toolbar>
			<ChangeAccountScreen
				number={number}
				unknown={unknown}
				onChangeNumber={changeNumber}
				onContinue={() =>
					void recognise().catch((failure: unknown) => console.warn("PIN account could not be read", failure))
				}
				onSignInWithAccount={signInWithAccount}
			/>
		</>
	)
}
