import { Text, View } from 'react-native'
import { PALETTE, rgb } from '../../../tokens'

type ErrorStateProps = {
	title: string
	message?: string
	actionLabel?: string
	onAction?: (() => void) | string
}

export function ErrorState({ title, message }: ErrorStateProps) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
			<Text style={{ color: rgb(PALETTE.white), fontSize: 20, fontWeight: 'bold' }}>{title}</Text>
			{message && <Text style={{ color: rgb(PALETTE.white, 0.6), fontSize: 14, marginTop: 8 }}>{message}</Text>}
		</View>
	)
}
