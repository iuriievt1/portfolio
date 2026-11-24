import { ADMINISTRATION_ERROR_CODE, CONFIGURATION_KEY, LANGUAGE_CODE_PATTERN } from "@ansora/contracts"
import { cn } from "cn"
import { useEffect, useMemo, useState } from "react"
import { useLocation, useSearchParams } from "react-router"
import { errorCodeOf } from "@/api/client"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { SaveWarnings } from "@/components/custom/save-warnings"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import {
	CONFIGURATION_SECTION,
	type ConfigurationSection,
	type ConfigurationTabId,
} from "@/features/configuration/constants/configuration-fields"
import { changeConfiguration, useConfiguration } from "@/features/configuration/hooks/use-configuration"
import {
	type EditValue,
	type EditValues,
	editValuesOf,
	formStateOf,
	isShown,
	languageCodes,
	sectionsFor,
} from "@/features/configuration/lib/configuration-form"
import { firstTabWithKeys, tabFromParam, tabsOf, tabsWithKeys } from "@/features/configuration/lib/configuration-tabs"
import { sectionText, tabText } from "@/features/configuration/lib/configuration-text"
import { missingNamesMessage } from "@/features/configuration/lib/missing-names"
import type {
	Configuration,
	ConfigurationItem,
	ConfigurationSaveResult,
} from "@/features/configuration/types/configuration.types"
import { QuickLoginWarning } from "@/features/login-methods/components/QuickLoginWarning"
import { installationPreview } from "@/features/login-methods/lib/installation-login-methods"
import { hasQuickLoginMethod, warningsBeyondPreview } from "@/features/login-methods/lib/login-method-choices"
import { RegistrySyncStatus } from "@/features/registry/components/RegistrySyncStatus"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { UnsavedChangesPrompt } from "@/layouts/unsaved-changes-prompt"
import { CONFIGURATION_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount, formatDateTime } from "@/lib/format"
import { requestFailure } from "@/lib/request-failure"
import { savedAtText } from "@/lib/saved-at"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard"
import { ConfigurationFieldControl } from "./ConfigurationFieldControl"
import { ReasonDialog } from "./ReasonDialog"

const texts = cs.configuration

// DESIGN.md 9.1
const TAB_PARAM = "tab"

interface SavedConfiguration {
	result: ConfigurationSaveResult
	at: string
}

// CAP-012-R01, CAP-012-R19
export function ConfigurationPage() {
	useShellTitle(texts.heading)
	const configuration = useConfiguration()
	const [saved, setSaved] = useState<SavedConfiguration | undefined>(undefined)
	const loaded = configuration.data
	const current =
		saved !== undefined && (loaded === undefined || saved.result.version >= loaded.version) ? saved.result : loaded

	if (current === undefined) {
		return (
			<PagePending
				failure={requestFailure(configuration.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={configuration.reload}
			/>
		)
	}

	return (
		<ConfigurationForm
			key={current.version}
			configuration={current}
			saved={saved?.result.version === current.version ? saved : undefined}
			onSaved={(result) => setSaved({ result, at: new Date().toISOString() })}
			onReload={() => {
				setSaved(undefined)
				configuration.reload()
			}}
		/>
	)
}

interface FormProps {
	configuration: Configuration
	saved: SavedConfiguration | undefined
	onSaved: (result: ConfigurationSaveResult) => void
	onReload: () => void
}

function ConfigurationForm({ configuration, saved, onSaved, onReload }: FormProps) {
	const sections = useMemo(() => sectionsFor(configuration.items), [configuration.items])
	const tabs = useMemo(() => tabsOf(sections), [sections])
	const initial = useMemo(() => editValuesOf(sections, configuration.items), [sections, configuration.items])
	const [searchParams, setSearchParams] = useSearchParams()
	const { hash } = useLocation()
	const [edits, setEdits] = useState<EditValues>(initial)
	const [showAllErrors, setShowAllErrors] = useState(false)
	const [reasonOpen, setReasonOpen] = useState(false)
	const [failure, setFailure] = useState<unknown>(undefined)
	const activeTab = tabFromParam(searchParams.get(TAB_PARAM), tabs)
	const state = formStateOf(sections, configuration.items, edits)
	const touched = Object.keys(edits).filter((key) => JSON.stringify(edits[key]) !== JSON.stringify(initial[key]))
	const dirty = touched.length > 0
	const blocker = useUnsavedChangesGuard(dirty)

	// DESIGN.md 9.1
	useEffect(() => {
		if (hash !== "") {
			document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" })
		}
	}, [hash])

	const preview = installationPreview(edits)
	const onlyAccountLogin = !hasQuickLoginMethod(preview)
	const failureCode = errorCodeOf(failure)
	const languageRejected = failureCode === ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED
	const registrySyncEnabled = isRegistrySyncEnabled(configuration.items)

	const showTab = (tab: ConfigurationTabId) =>
		setSearchParams(tab === tabs[0]?.id ? {} : { [TAB_PARAM]: tab }, { replace: true })
	const change = (key: string, edit: EditValue) => setEdits((previous) => ({ ...previous, [key]: edit }))
	const discard = () => {
		setEdits(initial)
		setShowAllErrors(false)
		setFailure(undefined)
	}
	const hasErrors = Object.keys(state.errors).length > 0
	const requestSave = () => {
		if (hasErrors) {
			setShowAllErrors(true)
			const tab = firstTabWithKeys(tabs, Object.keys(state.errors))
			if (tab !== undefined) {
				showTab(tab)
			}
			return
		}
		setReasonOpen(true)
	}
	const save = async (reason: string) => {
		setFailure(undefined)
		try {
			const result = await changeConfiguration({
				expected_version: configuration.version,
				reason,
				changes: state.changes,
			})
			setReasonOpen(false)
			onSaved(result)
		} catch (error) {
			setReasonOpen(false)
			setFailure(error)
		}
	}
	const errorFor = (key: string): string | undefined => {
		if (languageRejected && key === CONFIGURATION_KEY.DEFAULT_LANGUAGE) {
			return cs.errors.defaultLanguageNotSupported
		}
		return showAllErrors || touched.includes(key) ? state.errors[key] : undefined
	}
	const changedTabs = tabsWithKeys(tabs, touched)
	const invalidTabs = tabsWithKeys(
		tabs,
		Object.keys(state.errors).filter((key) => errorFor(key) !== undefined),
	)
	const supportedLanguages = languageCodes(String(edits[CONFIGURATION_KEY.SUPPORTED_LANGUAGES] ?? "")).filter((code) =>
		LANGUAGE_CODE_PATTERN.test(code),
	)

	return (
		<div className="flex max-w-4xl flex-col gap-(--section-gap)">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					{fillText(texts.version, {
						version: formatCount(configuration.version),
						time: formatDateTime(configuration.created_at),
					})}
				</p>
				{dirty ? null : <SaveStatus message={savedAtText(saved?.at)} />}
			</div>
			{failure === undefined ? null : (
				<Notice
					tone={NOTICE_TONE.CRITICAL}
					action={
						failureCode === ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT ? (
							<Button variant="outline" size="sm" onClick={onReload}>
								{texts.reload}
							</Button>
						) : undefined
					}
				>
					{missingNamesMessage(failure) ?? errorMessageOf(failure, CONFIGURATION_MESSAGES)}
				</Notice>
			)}
			{showAllErrors && hasErrors ? <Notice tone={NOTICE_TONE.CRITICAL}>{cs.common.invalid}</Notice> : null}
			{saved === undefined || dirty ? null : (
				<SaveWarnings messages={warningsBeyondPreview(saved.result.warnings, preview)} />
			)}
			<Card className="gap-0 py-0">
				<Tabs value={activeTab} onValueChange={(value) => showTab(tabFromParam(String(value), tabs))}>
					<TabsList aria-label={texts.heading}>
						{tabs.map((tab) => (
							<TabsTab key={tab.id} value={tab.id} ref={tab.id === activeTab ? revealTab : undefined}>
								{tabText(tab.id)}
								<TabMarker changed={changedTabs.has(tab.id)} invalid={invalidTabs.has(tab.id)} />
							</TabsTab>
						))}
					</TabsList>
					{tabs.map((tab) => (
						<TabsPanel key={tab.id} value={tab.id} className="divide-y">
							{tab.sections.map((section) => (
								<ConfigurationSectionPanel
									key={section.id}
									section={section}
									edits={edits}
									supportedLanguages={supportedLanguages}
									errorFor={errorFor}
									onlyAccountLogin={onlyAccountLogin}
									registrySyncEnabled={registrySyncEnabled}
									onChange={change}
								/>
							))}
						</TabsPanel>
					))}
				</Tabs>
			</Card>
			{dirty ? (
				<div className="sticky bottom-0 z-10 -mb-(--section-gap) flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					<span className="w-full text-sm sm:mr-auto sm:w-auto">
						{fillText(texts.unsavedCount, { count: formatCount(touched.length) })}
					</span>
					<Button variant="outline" className="flex-1 sm:flex-none" onClick={discard}>
						{texts.discard}
					</Button>
					<Button
						className="flex-1 sm:flex-none"
						disabled={!hasErrors && state.changes.length === 0}
						onClick={requestSave}
					>
						{texts.save}
					</Button>
				</div>
			) : null}
			<ReasonDialog
				open={reasonOpen}
				changeCount={state.changes.length}
				onlyAccountLogin={onlyAccountLogin}
				onOpenChange={setReasonOpen}
				onSubmit={save}
			/>
			<UnsavedChangesPrompt blocker={blocker} />
		</div>
	)
}

function revealTab(tab: HTMLElement | null): void {
	tab?.scrollIntoView({ block: "nearest", inline: "nearest" })
}

// CAP-024-R04
function isRegistrySyncEnabled(items: readonly ConfigurationItem[]): boolean {
	const period = items.find((item) => item.key === CONFIGURATION_KEY.REGISTRY_SYNC_PERIOD_SECONDS)?.value
	return period !== null && period !== undefined
}

function TabMarker({ changed, invalid }: { changed: boolean; invalid: boolean }) {
	if (!(changed || invalid)) {
		return null
	}
	return (
		<>
			<span aria-hidden className={cn("size-1.5 rounded-full", invalid ? "bg-destructive" : "bg-primary")} />
			<span className="sr-only">{invalid ? texts.tabInvalid : texts.tabChanged}</span>
		</>
	)
}

interface SectionProps {
	section: ConfigurationSection
	edits: EditValues
	supportedLanguages: readonly string[]
	errorFor: (key: string) => string | undefined
	onlyAccountLogin: boolean
	registrySyncEnabled: boolean
	onChange: (key: string, edit: EditValue) => void
}

function ConfigurationSectionPanel({
	section,
	edits,
	supportedLanguages,
	errorFor,
	onlyAccountLogin,
	registrySyncEnabled,
	onChange,
}: SectionProps) {
	const text = sectionText(section.id)
	return (
		<PageSection id={section.id} title={text.heading} description={text.description}>
			<div className="flex flex-col gap-4">
				{section.id === CONFIGURATION_SECTION.LOGIN_METHODS && onlyAccountLogin ? <QuickLoginWarning /> : null}
				{section.fields.map((field) => {
					const edit = edits[field.key]
					if (edit === undefined || !isShown(field, edits)) {
						return null
					}
					return (
						<ConfigurationFieldControl
							key={field.key}
							field={field}
							edit={edit}
							supportedLanguages={supportedLanguages}
							error={errorFor(field.key)}
							onChange={(next) => onChange(field.key, next)}
						/>
					)
				})}
				{section.id === CONFIGURATION_SECTION.REGISTRY && registrySyncEnabled ? (
					<div className="flex flex-col gap-3 border-t pt-4">
						<h3 className="text-sm font-medium">{cs.registry.sync.heading}</h3>
						<RegistrySyncStatus />
					</div>
				) : null}
			</div>
		</PageSection>
	)
}
