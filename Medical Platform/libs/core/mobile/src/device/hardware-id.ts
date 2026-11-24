import type { CryptoAndKeys } from "../native"

// CAP-006-R19, administration.yaml Device.blocked_predecessor
export async function hardwareIdOf(keys: Pick<CryptoAndKeys, "deviceKey" | "sha256Text">): Promise<string> {
	const { publicKeyJwk } = await keys.deviceKey()
	const canonical = JSON.stringify({
		crv: publicKeyJwk.crv,
		kty: publicKeyJwk.kty,
		x: publicKeyJwk.x,
		y: publicKeyJwk.y,
	})
	return await keys.sha256Text(canonical)
}
