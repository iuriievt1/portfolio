import { requireNativeView, requireOptionalNativeModule } from "expo"
import type { ComponentType, RefAttributes } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import type { DocumentScanner } from "./index"

const MODULE_NAME = "DocumentScanner"

// CAP-015-R10
export const TORCH_MODE = {
	ON: "on",
	OFF: "off",
} as const

export type TorchMode = (typeof TORCH_MODE)[keyof typeof TORCH_MODE]

// CAP-018-R02
export interface EdgesChange {
	found: boolean
}

export interface DocumentScannerViewProps {
	isActive: boolean
	torchMode: TorchMode
	// A.1 Skener
	edgeColor: string
	edgeFillColor: string
	style?: StyleProp<ViewStyle>
	onEdgesChange?: (event: { nativeEvent: EdgesChange }) => void
	// E16
	onCameraUnavailable?: () => void
}

// CAP-018-R02, CAP-009-R11
export interface CapturedPage {
	id: string
	preview: string | null
}

export interface DocumentScannerViewHandle {
	// CAP-018-R02, CAP-018-R03
	capturePage(): Promise<CapturedPage>
}

export type DocumentScannerViewComponent = ComponentType<
	DocumentScannerViewProps & RefAttributes<DocumentScannerViewHandle>
>

// NAB-191–195, Q-050
const nativeModule = requireOptionalNativeModule<DocumentScanner>(MODULE_NAME) ?? undefined

export function documentScanner(): DocumentScanner | undefined {
	return nativeModule
}

export const DocumentScannerView: DocumentScannerViewComponent | undefined =
	nativeModule === undefined ? undefined : requireNativeView(MODULE_NAME)
