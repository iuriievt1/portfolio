import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { DocumentScannerView } from "@ansora/core-mobile"
import { ROUTE } from "../../navigation/routes"

// CAP-015-R31, CAP-018-R14
export function draftRouteOf(kind: AcquisitionKind): typeof ROUTE.CAPTURE | typeof ROUTE.SCAN | undefined {
	if (kind === ACQUISITION_KIND.PHOTO) {
		return ROUTE.CAPTURE
	}
	return DocumentScannerView === undefined ? undefined : ROUTE.SCAN
}

// CAP-014-R14, CAP-018-R11
export function summaryRouteOf(kind: AcquisitionKind): typeof ROUTE.CAPTURE_SUMMARY | typeof ROUTE.SCAN_SUMMARY {
	return kind === ACQUISITION_KIND.PHOTO ? ROUTE.CAPTURE_SUMMARY : ROUTE.SCAN_SUMMARY
}
