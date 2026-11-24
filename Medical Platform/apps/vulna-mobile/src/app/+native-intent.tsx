import { isLoginReturnUrl } from "@ansora/core-mobile"

interface SystemPath {
	path: string
	initial: boolean
}

export function redirectSystemPath({ path }: SystemPath): string | null {
	return isLoginReturnUrl(path) ? null : path
}
