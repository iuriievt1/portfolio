import { describe, expect, it } from "vitest"
import { nameBasedUuid } from "../name-based-uuid"

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

describe("name-based UUID RFC 9562 version 5", () => {
	it("matches the example of RFC 9562 appendix A.4", () => {
		expect(nameBasedUuid(DNS_NAMESPACE, "www.example.com")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2")
	})

	it("gives the same name the same identifier and another name another one", () => {
		expect(nameBasedUuid(DNS_NAMESPACE, "a")).toBe(nameBasedUuid(DNS_NAMESPACE, "a"))
		expect(nameBasedUuid(DNS_NAMESPACE, "a")).not.toBe(nameBasedUuid(DNS_NAMESPACE, "b"))
	})
})
