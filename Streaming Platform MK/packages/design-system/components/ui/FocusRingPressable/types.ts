import type { ReactNode, Ref } from 'react'
import type { StyleProp, View, ViewStyle } from 'react-native'

export type FocusRingPressableProps = {
	onPress?: () => void
	className?: string
	style?: StyleProp<ViewStyle>
	ref?: Ref<View>
	hasTVPreferredFocus?: boolean
	onFocus?: () => void
	onBlur?: () => void
	focusable?: boolean
	children?: ReactNode
}
