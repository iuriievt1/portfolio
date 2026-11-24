export const SYMBOL_SEX = {
	FEMALE: "female",
	MALE: "male",
} as const

export type SymbolSex = (typeof SYMBOL_SEX)[keyof typeof SYMBOL_SEX]
