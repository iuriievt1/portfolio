import type { ReactNode } from "react"
import { View } from "react-native"
import { Body, Heading } from "./typography"

interface Props {
	icon: ReactNode
	heading: string
	body: string
}

export function StateMessage({ icon, heading, body }: Props) {
	return (
		<View className="gap-4">
			{icon}
			<Heading>{heading}</Heading>
			<Body>{body}</Body>
		</View>
	)
}
