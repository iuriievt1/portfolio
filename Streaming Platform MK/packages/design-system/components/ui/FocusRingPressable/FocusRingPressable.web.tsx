import { cn } from '@pkg/utils'
import type { FocusRingPressableProps } from './types'

export function FocusRingPressable({ onPress, className, style, children }: FocusRingPressableProps) {
	return (
		<button
			type='button'
			onClick={onPress}
			className={cn(
				'cursor-pointer border-none bg-transparent p-0 text-left',
				'outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
				'transition-transform duration-150 active:scale-press',
				className,
			)}
			style={style as React.CSSProperties}
		>
			{children}
		</button>
	)
}
FocusRingPressable.displayName = 'FocusRingPressable'
