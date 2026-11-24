import { createContext, useContext, useEffect } from "react"
import type { ShellCrumb } from "@/components/custom/app-shell"

export interface ShellTitle {
	title: string
	parent?: ShellCrumb
}

export const ShellTitleContext = createContext<((title: ShellTitle) => void) | undefined>(undefined)

export function useShellTitle(title: string, parent?: ShellCrumb): void {
	const setTitle = useContext(ShellTitleContext)
	if (setTitle === undefined) {
		throw new Error("the page title is set only inside the application shell")
	}
	const parentTo = parent?.to
	const parentLabel = parent?.label
	useEffect(() => {
		const crumb = parentTo === undefined || parentLabel === undefined ? undefined : { to: parentTo, label: parentLabel }
		setTitle({ title, parent: crumb })
	}, [setTitle, title, parentTo, parentLabel])
}
