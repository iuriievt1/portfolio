import { describe, expect, it } from "vitest"
import { canonicalJson } from "../canonical-json"

describe("canonical JSON", () => {
	it("sorts object keys by their UTF-16 code units at every level and drops whitespace", () => {
		expect(canonicalJson({ b: 1, a: { z: true, é: null, Z: [2, { y: "x", x: "y" }] } })).toBe(
			'{"a":{"Z":[2,{"x":"y","y":"x"}],"z":true,"é":null},"b":1}',
		)
	})

	it("keeps arrays in order and escapes strings as JSON does", () => {
		expect(canonicalJson(["\n", '"', "\u0001", "ěšč"])).toBe('["\\n","\\"","\\u0001","ěšč"]')
	})

	it("serializes numbers the way JavaScript prints them", () => {
		expect(canonicalJson([1, 1.5, -0, 1e21, 0.000_001])).toBe("[1,1.5,0,1e+21,0.000001]")
	})

	it("refuses a number JSON cannot carry", () => {
		expect(() => canonicalJson(Number.NaN)).toThrow()
		expect(() => canonicalJson([Number.POSITIVE_INFINITY])).toThrow()
	})
})
