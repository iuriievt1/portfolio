const LOADER_OPTIONS = ["--require", "-r", "--import"] as const

function isLoaderOption(argument: string): boolean {
	return LOADER_OPTIONS.some((option) => argument === option)
}

function isInlineLoaderOption(argument: string): boolean {
	return LOADER_OPTIONS.some((option) => argument.startsWith(`${option}=`))
}

export function loaderArgumentsOf(execArgv: readonly string[]): string[] {
	return execArgv.flatMap((argument, index) => {
		const value = execArgv[index + 1]
		if (isLoaderOption(argument) && value !== undefined) {
			return [argument, value]
		}
		return isInlineLoaderOption(argument) ? [argument] : []
	})
}
