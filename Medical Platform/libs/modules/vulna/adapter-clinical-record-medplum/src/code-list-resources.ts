import { type ClinicalCodeList, type ClinicalCodeListSet, nameIn } from "@ansora/vulna-domain/ports"
import type { CodeSystem, ValueSet } from "./fhir-types"
import { codeSystemUrlOf, valueSetUrlOf } from "./identifiers"
import { type ProjectionContext, projectionMetaOf } from "./resource-meta"

// ADR-050 bod 7, CAP-017-R08
const INACTIVE = "inactive"
const INACTIVE_PROPERTY_URI = "http://hl7.org/fhir/concept-properties#inactive"
const ACTIVE_URL_SUFFIX = "-active"
const ACTIVE_NAME_SUFFIX = "Active"
const WORD_SEPARATOR = "-"

export interface CodeListUrls {
	codeSystem: string
	valueSet: string
	activeValueSet: string
}

// ADR-050 bod 7, CAP-012-R30
export function codeListUrlsOf(instanceBase: string, codeListCode: string): CodeListUrls {
	const valueSet = valueSetUrlOf(instanceBase, codeListCode)
	return {
		codeSystem: codeSystemUrlOf(instanceBase, codeListCode),
		valueSet,
		activeValueSet: `${valueSet}${ACTIVE_URL_SUFFIX}`,
	}
}

function computableNameOf(code: string): string {
	return code
		.split(WORD_SEPARATOR)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("")
}

// CAP-017-R20, CAP-017-R08, CAP-017-R18, CAP-017-S15, ADR-050 bod 3
export function codeSystemOf(
	list: ClinicalCodeList,
	set: ClinicalCodeListSet,
	urls: CodeListUrls,
	context: ProjectionContext,
): CodeSystem {
	const codeSystem: CodeSystem = {
		resourceType: "CodeSystem",
		meta: projectionMetaOf(context),
		url: urls.codeSystem,
		version: set.version,
		name: computableNameOf(list.code),
		title: list.title,
		status: "active",
		caseSensitive: true,
		valueSet: urls.valueSet,
		content: "complete",
		count: list.concepts.length,
		property: [{ code: INACTIVE, uri: INACTIVE_PROPERTY_URI, type: "boolean" }],
	}
	if (list.concepts.length > 0) {
		codeSystem.concept = list.concepts.map((concept) => ({
			code: concept.code,
			display: nameIn(concept.names, set.defaultLanguage),
			designation: Object.entries(concept.names).map(([language, value]) => ({ language, value })),
			...(concept.isActive ? {} : { property: [{ code: INACTIVE, valueBoolean: true }] }),
		}))
	}
	return codeSystem
}

// CAP-017-R20, CAP-017-S15
export function wholeValueSetOf(
	list: ClinicalCodeList,
	set: ClinicalCodeListSet,
	urls: CodeListUrls,
	context: ProjectionContext,
): ValueSet {
	return {
		resourceType: "ValueSet",
		meta: projectionMetaOf(context),
		url: urls.valueSet,
		version: set.version,
		name: computableNameOf(list.code),
		title: list.title,
		status: "active",
		compose: { inactive: true, include: [{ system: urls.codeSystem, version: set.version }] },
	}
}

// CAP-017-R20
export function activeValueSetOf(
	list: ClinicalCodeList,
	set: ClinicalCodeListSet,
	urls: CodeListUrls,
	context: ProjectionContext,
): ValueSet {
	const active = list.concepts.filter((concept) => concept.isActive).map((concept) => ({ code: concept.code }))
	const included = { system: urls.codeSystem, version: set.version }
	return {
		resourceType: "ValueSet",
		meta: projectionMetaOf(context),
		url: urls.activeValueSet,
		version: set.version,
		name: `${computableNameOf(list.code)}${ACTIVE_NAME_SUFFIX}`,
		title: list.title,
		status: "active",
		compose:
			active.length === 0
				? { include: [included], exclude: [included] }
				: { include: [{ ...included, concept: active }] },
	}
}
