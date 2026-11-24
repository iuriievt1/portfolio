import { useParams } from "react-router"
import { Card } from "@/components/ui/card"
import { useUser } from "@/features/users/hooks/use-user"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { userPagePath } from "@/lib/routes"
import { CardsTable } from "./CardsTable"

export function UserCardsPage() {
	const { userId = "" } = useParams()
	const { user, cards } = useUser(userId)
	const name = user.data?.display_name
	useShellTitle(cs.user.cards.heading, name === undefined ? undefined : { to: userPagePath(userId), label: name })

	return (
		<Card className="gap-0 py-0">
			<CardsTable cards={cards} />
		</Card>
	)
}
