import { View, type ViewProps } from 'react-native'
import { GLASS } from '../../../tokens/primitives'

export function GlassBackground({ style, children, ...props }: ViewProps) {
	return (
		<View style={[{ backgroundColor: GLASS.fallbackBg }, style]} {...props}>
			{children}
		</View>
	)
}
GlassBackground.displayName = 'GlassBackground'
