import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { BUFFERED_FILE_KIND, type BufferedFileKind } from "@ansora/core-mobile"

const RECORD_KIND: Record<BufferedFileKind, AcquisitionKind> = {
	[BUFFERED_FILE_KIND.IMAGE]: ACQUISITION_KIND.PHOTO,
	[BUFFERED_FILE_KIND.DOCUMENT_PAGE]: ACQUISITION_KIND.SCAN,
}

// CAP-015-R35
export function recordKindOf(fileKind: BufferedFileKind): AcquisitionKind {
	return RECORD_KIND[fileKind]
}
