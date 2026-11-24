import { USER_STATE } from "@ansora/contracts"
import { useState } from "react"
import { useParams } from "react-router"
import { DetailFields } from "@/components/custom/detail-fields"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection, PageSections } from "@/components/custom/page-section"
import { StatusPill } from "@/components/custom/status-pill"
import { USER_STATE_TONE } from "@/features/users/constants/state-tones"
import { useQrCodes, useUser } from "@/features/users/hooks/use-user"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { UnsavedChangesPrompt } from "@/layouts/unsaved-changes-prompt"
import { requestFailure } from "@/lib/request-failure"
import { ROUTES } from "@/lib/routes"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard"
import { CardsSection } from "./CardsSection"
import { DepartmentSection } from "./DepartmentSection"
import { QrCodeSection } from "./QrCodeSection"
import { RevocationSection } from "./RevocationSection"
import { RolesSection } from "./RolesSection"

const texts = cs.user

const USERS_CRUMB = { to: `/${ROUTES.USERS}`, label: cs.users.heading }

export function UserPage() {
	const { userId = "" } = useParams()
	const { user, cards } = useUser(userId)
	const qrCodes = useQrCodes(userId)
	const [rolesDirty, setRolesDirty] = useState(false)
	const [departmentDirty, setDepartmentDirty] = useState(false)
	const blocker = useUnsavedChangesGuard(rolesDirty || departmentDirty)
	useShellTitle(user.data?.display_name ?? texts.heading, USERS_CRUMB)

	if (user.data === undefined) {
		return (
			<PagePending
				failure={requestFailure(user.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={user.reload}
			/>
		)
	}

	// CAP-005-R12
	const reloadAfterRevocation = () => {
		user.reload()
		cards.reload()
		qrCodes.reload()
	}

	// DESIGN.md 9.3
	return (
		<PageSections narrow>
			<PageSection title={texts.details}>
				<DetailFields fields={detailsOf(user.data)} />
			</PageSection>
			<RolesSection
				key={`roles-${user.data.id}`}
				user={user.data}
				onSaved={user.reload}
				onDirtyChange={setRolesDirty}
			/>
			<DepartmentSection
				key={`department-${user.data.id}`}
				user={user.data}
				onSaved={user.reload}
				onDirtyChange={setDepartmentDirty}
			/>
			<CardsSection userId={user.data.id} cards={cards} canIssue={user.data.state === USER_STATE.ACTIVE} />
			<QrCodeSection user={user.data} qrCodes={qrCodes} />
			<RevocationSection user={user.data} onRevoked={reloadAfterRevocation} />
			<UnsavedChangesPrompt blocker={blocker} />
		</PageSections>
	)
}

function detailsOf(user: User) {
	return [
		{
			term: texts.personalNumber,
			value: <span className="identifier">{user.personal_number ?? cs.common.notStated}</span>,
		},
		{
			term: texts.loginName,
			value: <span className="identifier">{user.login_name ?? cs.common.notStated}</span>,
		},
		{ term: texts.email, value: user.email ?? cs.common.notStated },
		{
			term: texts.state,
			value: <StatusPill tone={USER_STATE_TONE[user.state]}>{cs.users.state[user.state]}</StatusPill>,
		},
	]
}
