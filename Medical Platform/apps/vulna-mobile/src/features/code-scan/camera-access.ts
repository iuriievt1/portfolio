import { type PermissionStatus, VisionCamera } from "react-native-vision-camera"

const AUTHORIZED: PermissionStatus = "authorized"
const NOT_DETERMINED: PermissionStatus = "not-determined"

export async function hasCameraAccess(): Promise<boolean> {
	const status = VisionCamera.cameraPermissionStatus
	if (status !== NOT_DETERMINED) {
		return status === AUTHORIZED
	}
	return await VisionCamera.requestCameraPermission()
}
