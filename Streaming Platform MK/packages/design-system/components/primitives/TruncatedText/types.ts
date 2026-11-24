export type TruncatedTextProps = {
	/** Maximum number of visible lines before truncation */
	lines: number
	/** The text content to truncate */
	children: string
	/** CSS/NativeWind class names for styling */
	className?: string
}
