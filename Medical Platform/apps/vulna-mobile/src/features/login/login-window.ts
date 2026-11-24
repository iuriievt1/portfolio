import { LOGIN_WINDOW_RESULT, type LoginWindow, type LoginWindowResult } from "@ansora/core-mobile"
import * as WebBrowser from "expo-web-browser"

const AUTH_SESSION_SUCCESS = "success"

export const platformLoginWindow: LoginWindow = {
	async open(url: string, returnUrl: string): Promise<LoginWindowResult> {
		const result = await WebBrowser.openAuthSessionAsync(url, returnUrl, {
			preferEphemeralSession: true,
			createTask: false,
		})
		return result.type === AUTH_SESSION_SUCCESS
			? { type: LOGIN_WINDOW_RESULT.RETURNED, url: result.url }
			: { type: LOGIN_WINDOW_RESULT.CANCELLED }
	},
}
