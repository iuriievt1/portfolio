import { describe, expect, it } from "vitest"
import { localizedNameOf } from "../code-lists"

describe("localized name", () => {
	it("CAP-015-S25 shows the name in the interface language", () => {
		expect(localizedNameOf({ cs: "Dekubitus", en: "Pressure injury" }, "en", "cs")).toBe("Pressure injury")
	})

	it("CAP-017-S07 falls back to the instance default language when the name is missing", () => {
		expect(localizedNameOf({ cs: "Dekubitus" }, "en", "cs")).toBe("Dekubitus")
	})
})
