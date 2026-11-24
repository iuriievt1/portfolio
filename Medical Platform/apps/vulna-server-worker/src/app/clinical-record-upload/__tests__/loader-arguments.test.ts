import { describe, expect, it } from "vitest"
import { loaderArgumentsOf } from "../utils/loader-arguments"

describe("loaders a viewing copy thread inherits", () => {
	it("keeps every required and imported loader with its value", () => {
		expect(loaderArgumentsOf(["--require", "@swc-node/register", "-r", "a", "--import", "b"])).toEqual([
			"--require",
			"@swc-node/register",
			"-r",
			"a",
			"--import",
			"b",
		])
	})

	it("keeps a loader written with its value inline", () => {
		expect(loaderArgumentsOf(["--require=@swc-node/register", "--import=b"])).toEqual([
			"--require=@swc-node/register",
			"--import=b",
		])
	})

	it("leaves out the options a thread refuses", () => {
		expect(
			loaderArgumentsOf(["--watch", "--env-file-if-exists=../../.env", "--require", "@swc-node/register"]),
		).toEqual(["--require", "@swc-node/register"])
	})

	it("leaves out a loader option without a value", () => {
		expect(loaderArgumentsOf(["--require"])).toEqual([])
	})
})
