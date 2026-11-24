import { DISCARD_SITUATION } from "@ansora/contracts"
import { useRouter } from "expo-router"
import { OwnDraftsFlow } from "../../../../features/drafts/components/OwnDraftsFlow"
import { openOwnDraft } from "../../../../features/drafts/open-own-draft"

// CAP-015-R18, CAP-015-S14, E56
export default function VisitDraftsRoute() {
	const router = useRouter()
	return (
		<OwnDraftsFlow
			situation={DISCARD_SITUATION.DRAFT_LIMIT_REACHED}
			onContinue={(draft) => router.replace(openOwnDraft(draft))}
			onClose={() => router.back()}
		/>
	)
}
