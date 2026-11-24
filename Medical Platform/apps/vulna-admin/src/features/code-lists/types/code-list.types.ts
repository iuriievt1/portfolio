import type { AdministrationContract } from "@ansora/contracts"

type Schemas = AdministrationContract.components["schemas"]

export type CodeList = Schemas["CodeList"]
export type CodeListItem = Schemas["CodeListItem"]
export type TranslationImport = Schemas["CodeListTranslationImport"]
export type TranslationRow = TranslationImport["items"][number]
export type TranslationImportResult = Schemas["CodeListTranslationImportResult"]
export type RejectedRow = NonNullable<Schemas["Error"]["rejected_rows"]>[number]
