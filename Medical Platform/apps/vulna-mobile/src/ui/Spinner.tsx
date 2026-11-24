import { ActivityIndicator } from "react-native"

export const SPINNER_SIZE = {
	PAGE: "page",
	CONTROL: "control",
} as const

export type SpinnerSize = (typeof SPINNER_SIZE)[keyof typeof SPINNER_SIZE]

const SCALE: Record<SpinnerSize, string> = {
	[SPINNER_SIZE.PAGE]: "scale-spinner",
	[SPINNER_SIZE.CONTROL]: "scale-spinner-control",
}

interface Props {
	size?: SpinnerSize
	color?: string
}

export function Spinner({ size = SPINNER_SIZE.PAGE, color }: Props) {
	return <ActivityIndicator size="small" color={color} className={SCALE[size]} />
}
