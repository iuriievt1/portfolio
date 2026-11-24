import { describe, expect, it } from "vitest"
import { type Schema, validate } from "../schema"

const schema: Schema = {
	type: "object",
	additionalProperties: false,
	required: ["id", "adapters", "baseImage"],
	properties: {
		id: { type: "string", pattern: "^[a-z]+$" },
		adapters: { $ref: "#/$defs/packageList" },
		targets: { type: "array", items: { enum: ["pacs", "database"] } },
		baseImage: {
			type: "object",
			additionalProperties: false,
			required: ["digest"],
			properties: { digest: { type: ["string", "null"], pattern: "^sha256:[a-f0-9]{4}$" } },
		},
	},
	$defs: { packageList: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } } },
}

describe("profile schema validation", () => {
	it("passes a valid document", () => {
		expect(validate({ id: "mou", adapters: ["a"], targets: ["pacs"], baseImage: { digest: null } }, schema)).toEqual([])
		expect(validate({ id: "mou", adapters: ["a"], baseImage: { digest: "sha256:abcd" } }, schema)).toEqual([])
	})

	it("names every problem with its path", () => {
		const problems = validate(
			{
				id: "MOU",
				adapters: ["a", "a"],
				targets: ["nis"],
				baseImage: { digest: "sha256:zz", extra: 1 },
				unknown: true,
			},
			schema,
		)
		expect(problems).toEqual([
			"$.id: does not match ^[a-z]+$",
			"$.adapters: duplicate items",
			"$.targets[0]: expected one of pacs, database",
			"$.baseImage.digest: does not match ^sha256:[a-f0-9]{4}$",
			"$.baseImage.extra: unknown key",
			"$.unknown: unknown key",
		])
	})

	it("reports missing required keys, wrong types and empty lists", () => {
		expect(validate({ id: 1, adapters: [] }, schema)).toEqual([
			"$.baseImage: missing",
			"$.id: expected string, got integer",
			"$.adapters: fewer than 1 items",
		])
	})

	it("refuses a schema keyword it does not implement", () => {
		expect(() => validate({}, { type: "object", oneOf: [] } as Schema)).toThrow("unsupported schema keyword: oneOf")
	})
})

describe("numeric bounds", () => {
	const bounded: Schema = { type: "integer", minimum: 4, maximum: 8 }

	it("accepts a value inside the bounds", () => {
		expect(validate(4, bounded)).toEqual([])
		expect(validate(8, bounded)).toEqual([])
	})

	it("names a value outside the bounds", () => {
		expect(validate(3, bounded)).toEqual(["$: below 4"])
		expect(validate(9, bounded)).toEqual(["$: above 8"])
	})
})
