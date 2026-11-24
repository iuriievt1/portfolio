import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { acceptsChoice, choiceAfterFailure, LANGUAGE_CHOICE } from "../language-choice"

describe("choiceAfterFailure", () => {
	it("CAP-015-S35 keeps the language and waits for the connection when the server cannot be reached", () => {
		expect(choiceAfterFailure(undefined, "en")).toEqual({ kind: LANGUAGE_CHOICE.OFFLINE, language: "en" })
	})

	it("CAP-015-R25 tells the user the language is no longer offered when the instance dropped it", () => {
		expect(choiceAfterFailure(ERROR_CODE.LANGUAGE_UNSUPPORTED, "en")).toEqual({ kind: LANGUAGE_CHOICE.UNSUPPORTED })
	})
})

describe("acceptsChoice", () => {
	it("CAP-015-S35 offers no language while one is being saved or the connection is missing", () => {
		expect(acceptsChoice({ kind: LANGUAGE_CHOICE.SAVING, language: "en" })).toBe(false)
		expect(acceptsChoice({ kind: LANGUAGE_CHOICE.OFFLINE, language: "en" })).toBe(false)
	})

	it("offers the list again once nothing waits", () => {
		expect(acceptsChoice({ kind: LANGUAGE_CHOICE.IDLE })).toBe(true)
		expect(acceptsChoice({ kind: LANGUAGE_CHOICE.UNSUPPORTED })).toBe(true)
	})
})
