import { createVerify, generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { signedLinkOf } from "../storage-link"

const PASSPHRASE = "storage signing passphrase"
const keys = generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicKeyEncoding: { type: "spki", format: "pem" },
	privateKeyEncoding: { type: "pkcs1", format: "pem", cipher: "aes-256-cbc", passphrase: PASSPHRASE },
})
const signing = {
	storageUrl: "https://vulna.mou.invalid/storage/",
	signingKey: keys.privateKey,
	signingKeyPassphrase: PASSPHRASE,
}
const link = { binaryId: "binary-1", projectId: "project-1", expiresAt: new Date("2026-10-22T10:05:00.000Z") }
const EXPIRES = "1792663500"

function verified(url: string, method: string): boolean {
	const signed = new URL(url)
	const signature = signed.searchParams.get("Signature") ?? ""
	signed.searchParams.delete("Signature")
	return createVerify("sha256").update(`${method} ${signed.toString()}`).verify(keys.publicKey, signature, "base64")
}

// ADR-053 (doplnění 2026-09-24) bod 1, datovy-model.md 13.4, Medplum 5.2.18 storage/routes.ts
describe("signed link to the bytes of a closed record CAP-020-R22", () => {
	it("CAP-020-S28 points to the binary on the published storage address with its expiry and project", () => {
		const url = new URL(signedLinkOf(signing, link))

		expect(`${url.origin}${url.pathname}`).toBe("https://vulna.mou.invalid/storage/binary-1")
		expect(url.searchParams.get("Expires")).toBe(EXPIRES)
		expect(url.searchParams.get("Project")).toBe("project-1")
	})

	it("CAP-011-R02 signs the link for reading only", () => {
		const url = signedLinkOf(signing, link)

		expect(verified(url, "GET")).toBe(true)
		expect(verified(url, "PUT")).toBe(false)
	})

	it("refuses a link whose expiry was changed after signing", () => {
		const url = signedLinkOf(signing, link).replace(`Expires=${EXPIRES}`, "Expires=1892663500")

		expect(verified(url, "GET")).toBe(false)
	})

	it("joins the storage address with or without the trailing slash", () => {
		const bare = signedLinkOf({ ...signing, storageUrl: "https://vulna.mou.invalid/storage" }, link)

		expect(new URL(bare).pathname).toBe("/storage/binary-1")
	})
})
