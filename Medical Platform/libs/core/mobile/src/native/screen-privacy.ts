import { requireNativeModule } from "expo"

const MODULE_NAME = "ScreenPrivacy"

interface ScreenPrivacyModule {
	allowSystemSheet(allowed: boolean): void
}

// NAB-142, CAP-013-R04
export function screenPrivacy(): ScreenPrivacyModule {
	return requireNativeModule<ScreenPrivacyModule>(MODULE_NAME)
}
