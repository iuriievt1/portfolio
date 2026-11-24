import { StatusBar } from "expo-status-bar"
import { View } from "react-native"
import type { BodyDiagramRegion } from "../../../api/code-lists"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"
import { formatDate } from "../../../utils/format-date"
import { CaptureBackAction, CaptureNavBar } from "../../capture/components/CaptureNavBar"
import { PillButton } from "../../capture/components/PillButton"
import { seriesTitleOf } from "../../capture/series-text"
import { type WoundPlace, woundPlaceOf } from "../body-site-text"
import type { EarlierPhoto } from "../earlier-photos"
import { EarlierPhotoRow } from "./EarlierPhotoRow"
import { EarlierThumbnail } from "./EarlierThumbnail"

interface Props {
	photos: readonly EarlierPhoto[]
	selected: EarlierPhoto
	regions: readonly BodyDiagramRegion[]
	patient: Patient
	onSelect: (imageId: string) => void
	onClose: () => void
}

// CAP-016-R17, CAP-015-R32, Figma 05 B.4
export function EarlierPhotoScreen({ photos, selected, regions, patient, onSelect, onClose }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const index = photos.findIndex((photo) => photo.imageId === selected.imageId)
	const date = formatDate(new Date(selected.takenAt), texts.language)
	const place = selected.bodySite === undefined ? undefined : woundPlaceOf(selected.bodySite, regions, nameOf, texts)

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar
				title={seriesTitleOf(index, photos.length, texts)}
				patient={patient}
				leading={<CaptureBackAction onPress={onClose} />}
			/>
			<View className="aspect-photo w-full">
				<EarlierThumbnail imageId={selected.imageId} className="h-full w-full" resizeMode={WHOLE_PHOTO} />
			</View>
			<View className="flex-1 justify-between pb-safe-gap-or-sheet">
				<View className="gap-2">
					<EarlierPhotoRow photos={photos} selectedId={selected.imageId} isInset onSelect={onSelect} />
					<Caption tone={TEXT_TONE.ON_BRAND} className="px-screen">
						{captionOf(date, place, texts)}
					</Caption>
				</View>
				<View className="px-screen">
					<PillButton label={texts.capture.review.close} className="px-5" onPress={onClose} />
				</View>
			</View>
		</View>
	)
}

// CAP-016-R19, Figma 05 B.4
function captionOf(date: string, place: WoundPlace | undefined, texts: Texts): string {
	const earlier = texts.capture.earlier
	if (place === undefined) {
		return date
	}
	if (place.region === undefined) {
		return fillText(earlier.captionWithoutRegion, { date, detail: place.detail }, texts.language)
	}
	return fillText(earlier.caption, { date, region: place.region, detail: place.detail }, texts.language)
}
