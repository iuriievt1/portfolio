const HOPS = /^\d{1,2}$/

/**
 * TLS is terminated by the deployment, not by the API process, so the scheme and host the device
 * signed into its proof ✓ RFC 9449 arrive in `X-Forwarded-*` headers. The value is the number of
 * proxies in front of the process; without it the headers are ignored.
 */
export function parseTrustProxyHops(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined
	}
	if (!HOPS.test(value)) {
		throw new Error(`TRUST_PROXY must be the number of proxies in front of the API process, got ${value}`)
	}
	return Number(value)
}
