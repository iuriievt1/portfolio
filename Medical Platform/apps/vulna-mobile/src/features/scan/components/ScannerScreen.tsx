import { type BufferedFile, DocumentScannerView, TORCH_MODE } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { type LayoutChangeEvent, StyleSheet, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import colors from "../../../styles/colors.json"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { ClearIcon } from "../../../ui/icons/ClearIcon"
import { type Area, frameWithin } from "../../capture/capture-frame"
import { CameraDenied } from "../../capture/components/CameraDenied"
import { CaptureControls } from "../../capture/components/CaptureControls"
import { CaptureNavAction, CaptureNavBar } from "../../capture/components/CaptureNavBar"
import { FileCounter } from "../../capture/components/FileCounter"
import { CAMERA_ACCESS } from "../../capture/hooks/use-camera-capture"
import type { PageScanner } from "../hooks/use-page-scanner"
import { SCAN_FAILURE, type ScanFailure } from "../scan-failure"
import { PageRow } from "./PageRow"

interface Props {
	patient: Patient
	pages: readonly BufferedFile[]
	shots: readonly string[]
	previews: ReadonlyMap<string, string>
	scanner: PageScanner
	isTorchOn: boolean
	onTorch: () => void
	onClose: () => void
	onContinue: () => void
	onOpenPage: (fileKey: string) => void
	onCropPage: (fileKey: string) => void
}

// CAP-018-R02, CAP-018-R03, CAP-018-R12, CAP-015-S02, E16, Figma 06 A.1, A.2, E.1, F.1
export function ScannerScreen({
	patient,
	pages,
	shots,
	previews,
	scanner,
	isTorchOn,
	onTorch,
	onClose,
	onContinue,
	onOpenPage,
	onCropPage,
}: Props) {
	const texts = useTexts()
	const [area, setArea] = useState<Area>({ width: 0, height: 0 })
	const measure = (event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)
	const [isCameraUnavailable, setCameraUnavailable] = useState(false)
	const isGranted = scanner.access === CAMERA_ACCESS.GRANTED && !isCameraUnavailable
	const isDenied = scanner.access === CAMERA_ACCESS.DENIED || isCameraUnavailable

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar
				title={texts.scan.title}
				patient={patient}
				leading={
					<CaptureNavAction label={texts.scan.close} onPress={onClose}>
						<ClearIcon color={colors["primary-foreground"]} />
					</CaptureNavAction>
				}
			/>
			<View className="flex-1 items-center" onLayout={measure}>
				<View style={frameWithin(area)}>
					{isGranted && DocumentScannerView !== undefined ? (
						<DocumentScannerView
							ref={scanner.scanner}
							style={StyleSheet.absoluteFill}
							isActive={scanner.isActive}
							torchMode={isTorchOn ? TORCH_MODE.ON : TORCH_MODE.OFF}
							edgeColor={colors["scan-edge"]}
							edgeFillColor={colors["scan-edge-fill"]}
							onCameraUnavailable={() => setCameraUnavailable(true)}
						/>
					) : null}
					{isDenied ? <CameraDenied /> : null}
				</View>
			</View>
			<View className="pb-safe-gap-or-sheet">
				<View className="flex-row items-center">
					<View className="flex-1">
						<PageRow
							pages={pages}
							shots={shots}
							previews={previews}
							hasSlot={isGranted && !scanner.isLimitReached}
							onSelect={onOpenPage}
						/>
					</View>
					{scanner.pageLimit === undefined ? null : (
						<FileCounter count={scanner.pageCount} limit={scanner.pageLimit} label={texts.scan.counter} />
					)}
				</View>
				<CaptureControls
					canUseCamera={isGranted}
					canShoot={scanner.canShoot}
					canContinue={pages.length + shots.length > 0}
					shutterLabel={texts.scan.shutter}
					onTorch={onTorch}
					onShoot={() => void scanner.shoot()}
					onContinue={onContinue}
				/>
			</View>
			<ScanFailureDialog failure={scanner.failure} onDismiss={scanner.dismissFailure} />
			<EdgelessPageDialog
				fileKey={scanner.edgelessPage}
				onCrop={(fileKey) => {
					scanner.dismissEdgelessPage()
					onCropPage(fileKey)
				}}
				onKeep={scanner.dismissEdgelessPage}
			/>
		</View>
	)
}

// E17, E18
function ScanFailureDialog({ failure, onDismiss }: { failure: ScanFailure | undefined; onDismiss: () => void }) {
	const texts = useTexts()
	if (failure === undefined) {
		return null
	}
	const { title, body } = scanFailureTextOf(failure, texts)
	return (
		<ConfirmDialog title={title} body={body} secondary={{ label: texts.capture.failure.close, onPress: onDismiss }} />
	)
}

// CAP-018-R10, CAP-018-S02, E21
function EdgelessPageDialog({
	fileKey,
	onCrop,
	onKeep,
}: {
	fileKey: string | undefined
	onCrop: (fileKey: string) => void
	onKeep: () => void
}) {
	const texts = useTexts().scan.edgesNotFound
	if (fileKey === undefined) {
		return null
	}
	return (
		<ConfirmDialog
			title={texts.title}
			body={texts.body}
			primary={{ label: texts.crop, onPress: () => onCrop(fileKey) }}
			secondary={{ label: texts.keep, onPress: onKeep }}
		/>
	)
}

function scanFailureTextOf(failure: ScanFailure, texts: Texts): { title: string; body: string } {
	switch (failure) {
		case SCAN_FAILURE.QUEUE_FULL:
			return texts.capture.failure.queueFull
		case SCAN_FAILURE.STORAGE_FULL:
			return texts.capture.failure.storageFull
		case SCAN_FAILURE.UNREADABLE:
			return texts.scan.failure.unreadable
		default:
			return failure satisfies never
	}
}
