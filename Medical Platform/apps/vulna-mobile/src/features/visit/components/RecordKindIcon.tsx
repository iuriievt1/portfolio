import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { View } from "react-native"
import { BandaidsIcon } from "../../../ui/icons/BandaidsIcon"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"

export function RecordKindIcon({ kind }: { kind: AcquisitionKind }) {
	const isPhoto = kind === ACQUISITION_KIND.PHOTO
	return (
		<View className="h-11 w-11 items-center justify-center">
			<View
				className={`h-category w-category items-center justify-center rounded-full ${isPhoto ? "bg-category-wound" : "bg-status-info"}`}
			>
				{isPhoto ? <BandaidsIcon /> : <FileTextIcon />}
			</View>
		</View>
	)
}
