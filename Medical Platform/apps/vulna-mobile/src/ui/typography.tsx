import { Text, type TextProps } from "react-native"

export const TEXT_TONE = {
	DEFAULT: "default",
	MUTED: "muted",
	ERROR: "error",
	ACCENT: "accent",
	ON_BRAND: "on_brand",
	ON_DARK: "on_dark",
	ON_DARK_MUTED: "on_dark_muted",
} as const

export type TextTone = (typeof TEXT_TONE)[keyof typeof TEXT_TONE]

type Props = TextProps & { className?: string; tone?: TextTone }

const TONE_COLOR: Record<TextTone, string> = {
	[TEXT_TONE.DEFAULT]: "text-foreground",
	[TEXT_TONE.MUTED]: "text-muted-foreground",
	[TEXT_TONE.ERROR]: "text-destructive",
	[TEXT_TONE.ACCENT]: "text-primary",
	[TEXT_TONE.ON_BRAND]: "text-primary-foreground",
	[TEXT_TONE.ON_DARK]: "text-capture-denied-foreground",
	[TEXT_TONE.ON_DARK_MUTED]: "text-capture-denied-muted",
}

export function Title({ className, tone = TEXT_TONE.DEFAULT, ...props }: Props) {
	return <Text className={joined(`font-bold text-title ${TONE_COLOR[tone]}`, className)} {...props} />
}

export function Heading({ className, tone = TEXT_TONE.DEFAULT, ...props }: Props) {
	return <Text className={joined(`font-semibold text-heading ${TONE_COLOR[tone]}`, className)} {...props} />
}

export function Body({ className, tone = TEXT_TONE.MUTED, ...props }: Props) {
	return <Text className={joined(`text-body ${TONE_COLOR[tone]}`, className)} {...props} />
}

export function Label({ className, tone = TEXT_TONE.DEFAULT, ...props }: Props) {
	return <Text className={joined(`font-semibold text-body ${TONE_COLOR[tone]}`, className)} {...props} />
}

export function Caption({ className, tone = TEXT_TONE.DEFAULT, ...props }: Props) {
	return <Text className={joined(`font-medium text-caption ${TONE_COLOR[tone]}`, className)} {...props} />
}

export function Detail({ className, tone = TEXT_TONE.MUTED, ...props }: Props) {
	return <Text className={joined(`text-detail ${TONE_COLOR[tone]}`, className)} {...props} />
}

function joined(base: string, extra: string | undefined): string {
	return extra === undefined ? base : `${base} ${extra}`
}
