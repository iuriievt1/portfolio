import { useTexts } from "../../../i18n/language-store"
import { Dimmable } from "../../../ui/Dimmable"
import { BarcodeIcon } from "../../../ui/icons/BarcodeIcon"
import { NfcIcon } from "../../../ui/icons/NfcIcon"
import { ScanIcon } from "../../../ui/icons/ScanIcon"
import { UserIcon } from "../../../ui/icons/UserIcon"
import { MethodTile } from "../../../ui/MethodTile"

export interface UnlockMethodsProps {
	disabled?: boolean
	qrCode: boolean
	barcode: boolean
	card: boolean
	onQrCode: () => void
	onBarcode: () => void
	onCard: () => void
	onAssignCard: (() => void) | undefined
	onAccount: () => void
}

export function UnlockMethods({
	disabled = false,
	qrCode,
	barcode,
	card,
	onQrCode,
	onBarcode,
	onCard,
	onAssignCard,
	onAccount,
}: UnlockMethodsProps) {
	const strings = useTexts()
	const texts = strings.unlock.methods
	return (
		<Dimmable className="h-method flex-row gap-3" dimmed={disabled}>
			{qrCode ? <MethodTile icon={<ScanIcon />} label={texts.qrCode} onPress={onQrCode} /> : null}
			{barcode ? <MethodTile icon={<BarcodeIcon />} label={texts.barcode} onPress={onBarcode} /> : null}
			{card ? <MethodTile icon={<NfcIcon />} label={texts.card} onPress={onCard} onLongPress={onAssignCard} /> : null}
			<MethodTile icon={<UserIcon />} label={texts.account} onPress={onAccount} />
		</Dimmable>
	)
}
