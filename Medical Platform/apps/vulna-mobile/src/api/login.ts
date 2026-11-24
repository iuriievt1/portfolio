import type { MobileContract } from "@ansora/contracts"
import type {
	BarcodeLoginApi,
	CardBindingApi,
	CardBindingReceipt,
	CardLoginApi,
	Challenge,
	LoginApi,
	OidcCallbackRequest,
	OidcStartRequest,
	OidcStartResponse,
	PinLoginApi,
	PinLoginRequest,
	QrCodeLoginApi,
	Session,
} from "@ansora/core-mobile"
import { callApi } from "./client"

const START_PATH: keyof MobileContract.paths = "/login/oidc"
const CALLBACK_PATH: keyof MobileContract.paths = "/login/oidc/callback"
const CHALLENGE_PATH: keyof MobileContract.paths = "/login/challenge"
const PIN_PATH: keyof MobileContract.paths = "/login/pin"
const CARD_PATH: keyof MobileContract.paths = "/login/card"
const QR_CODE_PATH: keyof MobileContract.paths = "/login/qr"
const BARCODE_PATH: keyof MobileContract.paths = "/login/barcode"
const CARD_BINDING_PATH: keyof MobileContract.paths = "/card-bindings"

export const loginApi: LoginApi = {
	startOidcLogin: (request: OidcStartRequest): Promise<OidcStartResponse> =>
		callApi<OidcStartResponse>(START_PATH, { method: "POST", body: request }),
	completeOidcLogin: (request: OidcCallbackRequest): Promise<Session> =>
		callApi<Session>(CALLBACK_PATH, { method: "POST", body: request }),
}

const issueChallenge = (): Promise<Challenge> => callApi<Challenge>(CHALLENGE_PATH, { method: "POST" })

export const pinLoginApi: PinLoginApi = {
	issueChallenge,
	loginWithPin: (request: PinLoginRequest): Promise<Session> =>
		callApi<Session>(PIN_PATH, { method: "POST", body: request }),
}

export const cardLoginApi: CardLoginApi = {
	issueChallenge,
	loginWithCard: (signedBody: string): Promise<Session> => callApi<Session>(CARD_PATH, { method: "POST", signedBody }),
}

export const qrCodeLoginApi: QrCodeLoginApi = {
	issueChallenge,
	loginWithQrCode: (signedBody: string): Promise<Session> =>
		callApi<Session>(QR_CODE_PATH, { method: "POST", signedBody }),
}

// identity.yaml loginWithBarcode
export const barcodeLoginApi: BarcodeLoginApi = {
	issueChallenge,
	loginWithBarcode: (signedBody: string): Promise<Session> =>
		callApi<Session>(BARCODE_PATH, { method: "POST", signedBody }),
}

export const cardBindingApi: CardBindingApi = {
	issueChallenge,
	completeCardBinding: (signedBody: string): Promise<CardBindingReceipt> =>
		callApi<CardBindingReceipt>(CARD_BINDING_PATH, { method: "POST", signedBody }),
}
