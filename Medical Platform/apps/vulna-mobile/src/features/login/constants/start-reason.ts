import { LOGIN_START_REASON, type LoginStartReason } from "@ansora/contracts"

export function startReasonOf(value: string | undefined): LoginStartReason {
	return Object.values(LOGIN_START_REASON).find((reason) => reason === value) ?? LOGIN_START_REASON.FIRST_LOGIN
}
