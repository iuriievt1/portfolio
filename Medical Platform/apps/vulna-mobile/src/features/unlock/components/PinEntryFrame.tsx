import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { ENTRY_COLUMN } from "../../../ui/EntryLayout"
import { Detail, type TextTone, Title } from "../../../ui/typography"
import { PinDots } from "./PinDots"
import { PinKeypad } from "./PinKeypad"

export interface PinMessage {
	text: string
	tone: TextTone
}

interface Props {
	heading: string
	message: PinMessage
	pin: string
	keypadDisabled: boolean
	onDigit: (digit: string) => void
	onErase: () => void
	children: ReactNode
}

export function PinEntryFrame({ heading, message, pin, keypadDisabled, onDigit, onErase, children }: Props) {
	return (
		<View className="flex-1 items-center justify-center bg-background">
			<View className="max-h-phone w-full flex-1 pb-safe-offset-4">
				<ScrollView contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
					<View className={`${ENTRY_COLUMN} grow pt-safe-offset-4`}>
						<View className="grow" />
						<View className="gap-6">
							<View className="items-center gap-6">
								<Title className="self-stretch text-center">{heading}</Title>
								<View className="w-full gap-3">
									<PinDots entered={pin.length} />
									<Animated.View key={message.text} entering={FadeIn}>
										<Detail tone={message.tone} className="min-h-message text-center">
											{message.text}
										</Detail>
									</Animated.View>
								</View>
							</View>
							<View className="gap-4">
								<PinKeypad disabled={keypadDisabled} onDigit={onDigit} onErase={onErase} />
								<View className="gap-3">{children}</View>
							</View>
						</View>
					</View>
				</ScrollView>
			</View>
		</View>
	)
}
