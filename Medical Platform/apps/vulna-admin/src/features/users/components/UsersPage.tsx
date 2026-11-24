import { zodResolver } from "@hookform/resolvers/zod"
import { MagnifyingGlassIcon, UsersIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useCallback, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useSearchParams } from "react-router"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { LoadFailure } from "@/components/custom/load-failure"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { USER_STATE_TONE } from "@/features/users/constants/state-tones"
import { useUsers } from "@/features/users/hooks/use-users"
import { type UserSearch, userSearchSchema } from "@/features/users/lib/user-search.schema"
import { departmentText, userRolesText } from "@/features/users/lib/user-text"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { userPagePath } from "@/lib/routes"
import { SEARCH_DEBOUNCE_MILLISECONDS, useDebouncedValue } from "@/lib/use-debounced-value"

const texts = cs.users

const SEARCH_FIELD_ID = "user-search"
const SEARCH_ERROR_ID = "user-search-error"
// DESIGN.md 9.1
const SEARCH_PARAM = "search"
const SKELETON_ROWS = 5

const COLUMNS: ColumnDef<User>[] = [
	{
		id: "name",
		header: texts.columns.name,
		cell: ({ row }) => <RowLink to={userPagePath(row.original.id)}>{row.original.display_name}</RowLink>,
	},
	{
		id: "personal_number",
		header: texts.columns.personalNumber,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => <span className="identifier">{row.original.personal_number ?? cs.common.notStated}</span>,
	},
	{
		id: "roles",
		header: texts.columns.roles,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => userRolesText(row.original),
	},
	{
		id: "department",
		header: texts.columns.department,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => <span className="identifier">{departmentText(row.original.department)}</span>,
	},
	{
		id: "state",
		header: texts.columns.state,
		cell: ({ row }) => (
			<StatusPill tone={USER_STATE_TONE[row.original.state]}>{texts.state[row.original.state]}</StatusPill>
		),
	},
]

export function UsersPage() {
	useShellTitle(texts.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	const search = searchParams.get(SEARCH_PARAM) ?? undefined
	const form = useForm<UserSearch>({
		resolver: zodResolver(userSearchSchema),
		mode: "onChange",
		defaultValues: { search: search ?? "" },
	})
	const typed = useWatch({ control: form.control, name: "search" })
	const searchError = form.formState.errors.search?.message

	const applySearch = useCallback(
		(value: string) => setSearchParams(value === "" ? {} : { [SEARCH_PARAM]: value }, { replace: true }),
		[setSearchParams],
	)

	const settled = useDebouncedValue(typed, SEARCH_DEBOUNCE_MILLISECONDS)
	useEffect(() => {
		if (settled !== typed) {
			return
		}
		const parsed = userSearchSchema.safeParse({ search: settled })
		if (parsed.success && parsed.data.search !== (search ?? "")) {
			applySearch(parsed.data.search)
		}
	}, [settled, typed, search, applySearch])

	const clearSearch = () => {
		form.reset({ search: "" })
		applySearch("")
	}

	return (
		<Card className="gap-0 py-0">
			<search className="border-b p-(--card-p)">
				<form
					className="flex max-w-sm flex-col gap-1.5"
					onSubmit={form.handleSubmit((values) => applySearch(values.search))}
				>
					<Label htmlFor={SEARCH_FIELD_ID} className="label-caps text-xs text-muted-foreground">
						{texts.search.label}
					</Label>
					<Input
						id={SEARCH_FIELD_ID}
						type="search"
						autoComplete="off"
						aria-invalid={searchError !== undefined}
						aria-describedby={searchError === undefined ? undefined : SEARCH_ERROR_ID}
						{...form.register("search")}
					/>
					{searchError === undefined ? null : (
						<p id={SEARCH_ERROR_ID} className="text-xs text-destructive">
							{searchError}
						</p>
					)}
				</form>
			</search>
			<UsersResults search={search} onClearSearch={clearSearch} />
		</Card>
	)
}

function UsersResults({ search, onClearSearch }: { search: string | undefined; onClearSearch: () => void }) {
	const { items: users, error, loading, hasMore, more, retry } = useUsers(search)

	if (users.length === 0) {
		if (loading) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		if (search !== undefined) {
			return (
				<EmptyState
					icon={<MagnifyingGlassIcon weight="bold" className="size-5" />}
					title={texts.empty}
					description={texts.emptyHint}
					action={
						<Button variant="ghost" size="sm" onClick={onClearSearch}>
							{texts.clearSearch}
						</Button>
					}
				/>
			)
		}
		return (
			<EmptyState
				icon={<UsersIcon weight="bold" className="size-5" />}
				title={texts.emptyAll}
				description={texts.emptyAllHint}
			/>
		)
	}

	return (
		<>
			<DataTable
				columns={COLUMNS}
				data={users}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(user) => user.id}
			/>
			<ListFooter
				errorMessage={error === undefined ? undefined : errorMessageOf(error)}
				hasMore={hasMore}
				loading={loading}
				moreLabel={cs.common.more}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onMore={more}
				onRetry={retry}
			/>
		</>
	)
}
