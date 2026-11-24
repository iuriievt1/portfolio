// datovy-model.md 4 „Artefakt“
export const ARTIFACT_SOURCE_KIND = {
	IMAGE: "image",
	DOCUMENT: "document",
} as const

export type ArtifactSourceKind = (typeof ARTIFACT_SOURCE_KIND)[keyof typeof ARTIFACT_SOURCE_KIND]
