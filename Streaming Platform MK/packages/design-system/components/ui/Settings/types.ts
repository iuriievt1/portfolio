export type SettingRowProps = {
	label: string
	description?: string
	value: boolean
	onToggle: (value: boolean) => void
}

export type SettingGroupProps = {
	title: string
	children: React.ReactNode
}
