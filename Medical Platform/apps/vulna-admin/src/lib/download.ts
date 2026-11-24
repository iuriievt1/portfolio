export function download(link: string): void {
	const anchor = document.createElement("a")
	anchor.href = link
	anchor.download = ""
	anchor.click()
}
