import { POSTGRES_INTEGER_MAX } from "../../../libs/database/postgres-integer"

// clinical-workflow.yaml syncCodeLists, getBodyDiagramBackground
export const CODE_LISTS_PATH = "sync/code-lists"
export const BODY_DIAGRAMS_PATH = "body-diagrams"
export const BODY_DIAGRAM_VERSION_PARAMETER = "version"
export const BACKGROUND_SUBPATH = `:${BODY_DIAGRAM_VERSION_PARAMETER}/background`
export const BACKGROUND_SEGMENT = "background"
export const CONTENT_TYPE_HEADER = "Content-Type"
export const SVG_CONTENT_TYPE = "image/svg+xml"
export const BODY_DIAGRAM_VERSION_MAX_LENGTH = 64

// administration.yaml listCodeLists, setCodeListItems, importCodeListTranslations
export const ADMIN_CODE_LISTS_PATH = "code-lists"
export const CODE_LIST_CODE_PARAMETER = "codeListCode"
export const CODE_LIST_ITEMS_SUBPATH = `:${CODE_LIST_CODE_PARAMETER}/items`
export const TRANSLATION_IMPORTS_SUBPATH = "translation-imports"
export const CODE_LIST_CODE_MAX_LENGTH = 100
export const CODE_LIST_ITEMS_MAX = 500
// int4
export const CODE_LIST_ITEM_SEQUENCE_MIN = 0
export const CODE_LIST_ITEM_SEQUENCE_MAX = POSTGRES_INTEGER_MAX
