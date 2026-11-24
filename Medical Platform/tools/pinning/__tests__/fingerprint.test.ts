import { describe, expect, it } from "vitest"
import { fingerprintOfCertificate, fingerprintOfKey } from "../fingerprint"

// Synthetic key and self-signed certificate; the expected value comes from openssl ✓ Q-040.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENbQFKBmbf9q+PEEnm3GiAHmJzqJQ
otd34KLYTCgGjOSqqFZzhuQ0a9RZZIZcJxsVgzkXmmL1IC5JYOye/i1sMg==
-----END PUBLIC KEY-----
`

const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIBkDCCATWgAwIBAgIULMe8CxFEgAuHVjoWyP6FuL3Se5UwCgYIKoZIzj0EAwIw
HTEbMBkGA1UEAwwSdnVsbmEudGVzdC5pbnZhbGlkMB4XDTI2MDkzMDA4MzMwOVoX
DTM2MDkyNzA4MzMwOVowHTEbMBkGA1UEAwwSdnVsbmEudGVzdC5pbnZhbGlkMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENbQFKBmbf9q+PEEnm3GiAHmJzqJQotd3
4KLYTCgGjOSqqFZzhuQ0a9RZZIZcJxsVgzkXmmL1IC5JYOye/i1sMqNTMFEwHQYD
VR0OBBYEFPvZgUymH9B9fwk18xVK0kQswJ/YMB8GA1UdIwQYMBaAFPvZgUymH9B9
fwk18xVK0kQswJ/YMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSQAwRgIh
ALD1tsAeK8KbDCMKUw/QodnE/tKC92hNRXHwWS1q/2VoAiEA9csYUYdKKx+wTrmF
SydPOt3GMjFBmA1hdQVvt/sQG68=
-----END CERTIFICATE-----
`

const EXPECTED = "sha256/z53uv4RWgzUQF7ioTGrtv0toCMq3Llln8jRCMeTocGQ="

function derOf(pem: string): Buffer {
	return Buffer.from(pem.replace(/-----[A-Z ]+-----/g, ""), "base64")
}

describe("SPKI fingerprint for pinning", () => {
	it("CAP-010-R06 computes the fingerprint of a certificate as openssl does", () => {
		expect(fingerprintOfCertificate(CERTIFICATE_PEM)).toBe(EXPECTED)
		expect(fingerprintOfCertificate(derOf(CERTIFICATE_PEM))).toBe(EXPECTED)
	})

	it("CAP-010-R07 computes the backup fingerprint from the next key before its certificate exists", () => {
		expect(fingerprintOfKey(PUBLIC_KEY_PEM)).toBe(EXPECTED)
	})
})
