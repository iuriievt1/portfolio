import { useLocalSearchParams, useRouter } from "expo-router"
import { OwnDraftsFlow } from "../../features/drafts/components/OwnDraftsFlow"
import { ownDraftsSituationOf } from "../../features/drafts/draft-discard"
import { openOwnDraft } from "../../features/drafts/open-own-draft"

// CAP-015-R17, CAP-015-R29, CAP-015-R16
export default function DraftsRoute() {
	const router = useRouter()
	const { situation } = useLocalSearchParams<{ situation?: string }>()
	return (
		<OwnDraftsFlow
			situation={ownDraftsSituationOf(situation)}
			onContinue={(draft) => router.replace(openOwnDraft(draft))}
			onClose={() => router.back()}
		/>
	)
}
