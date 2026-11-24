export type CameraErrorReport = (error: Error) => void

// CAP-015-R10, CAP-013-R02
export function cameraErrorHandlerOf(isAppActive: () => boolean, report: CameraErrorReport): CameraErrorReport {
	return (error) => {
		if (!isAppActive()) {
			return
		}
		report(error)
	}
}
