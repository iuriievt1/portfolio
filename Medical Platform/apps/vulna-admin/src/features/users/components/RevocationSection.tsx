import { USER_STATE } from "@ansora/contracts"
import { PageSection } from "@/components/custom/page-section"
import { RevokeAction } from "@/components/custom/revoke-action"
import { revokeUser } from "@/features/users/hooks/use-user"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"
import { REVOKE_DIALOG_TEXTS } from "@/lib/revoke-dialog-texts"

const texts = cs.user.revocation

interface Props {
	user: User
	onRevoked: () => void
}

// CAP-005-R07, CAP-005-R12, CAP-002-R08
export function RevocationSection({ user, onRevoked }: Props) {
	if (user.state === USER_STATE.REVOKED) {
		return (
			<PageSection title={texts.heading}>
				<p className="text-sm text-muted-foreground">{texts.revoked}</p>
			</PageSection>
		)
	}
	return (
		<PageSection
			title={texts.heading}
			action={
				<RevokeAction
					{...REVOKE_DIALOG_TEXTS}
					label={texts.action}
					accessibleLabel={undefined}
					heading={fillText(texts.confirmHeading, { name: user.display_name })}
					body={texts.confirmBody}
					revoke={() => revokeUser(user.id)}
					onRevoked={onRevoked}
				/>
			}
		>
			<p className="text-sm text-muted-foreground">{texts.description}</p>
		</PageSection>
	)
}
