import { USER_SEARCH_MAX_LENGTH } from "@ansora/contracts"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUserSearch } from "@/features/users/hooks/use-users"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { SEARCH_DEBOUNCE_MILLISECONDS, useDebouncedValue } from "@/lib/use-debounced-value"

const texts = cs.users.picker

const RESULTS_LIMIT = 5

interface Props {
	id: string
	value: User | undefined
	onChange: (user: User | undefined) => void
	invalid: boolean
	describedBy: string | undefined
}

export function UserPicker({ id, value, onChange, invalid, describedBy }: Props) {
	const [typed, setTyped] = useState("")
	const search = useDebouncedValue(typed.trim(), SEARCH_DEBOUNCE_MILLISECONDS)

	if (value !== undefined) {
		return (
			<div className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-sm">
				<UserLine user={value} />
				<Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
					{texts.change}
				</Button>
			</div>
		)
	}
	return (
		<div className="flex flex-col gap-1.5">
			<Input
				id={id}
				type="search"
				autoComplete="off"
				maxLength={USER_SEARCH_MAX_LENGTH}
				value={typed}
				onChange={(event) => setTyped(event.target.value)}
				aria-invalid={invalid}
				aria-describedby={describedBy}
			/>
			{search === "" ? null : <Matches search={search} onPick={onChange} />}
		</div>
	)
}

function Matches({ search, onPick }: { search: string; onPick: (user: User) => void }) {
	const matches = useUserSearch(search, RESULTS_LIMIT)

	if (matches.error !== undefined) {
		return (
			<p role="alert" className="text-xs text-destructive">
				{errorMessageOf(matches.error)}
			</p>
		)
	}
	if (matches.data === undefined) {
		return (
			<p role="status" className="text-xs text-muted-foreground">
				{cs.common.loading}
			</p>
		)
	}
	if (matches.data.length === 0) {
		return (
			<p role="status" className="text-xs text-muted-foreground">
				{texts.noMatch}
			</p>
		)
	}
	return (
		<ul aria-label={texts.matches} className="flex flex-col rounded-lg border">
			{matches.data.map((user) => (
				<li key={user.id} className="border-b last:border-b-0">
					<button
						type="button"
						onClick={() => onPick(user)}
						className="flex w-full items-center px-2.5 py-1.5 text-left text-sm outline-hidden hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
					>
						<UserLine user={user} />
					</button>
				</li>
			))}
		</ul>
	)
}

function UserLine({ user }: { user: User }) {
	return (
		<span className="flex min-w-0 items-baseline gap-2">
			<span className="truncate font-medium">{user.display_name}</span>
			<span className="identifier text-muted-foreground">{user.personal_number ?? cs.common.notStated}</span>
		</span>
	)
}
