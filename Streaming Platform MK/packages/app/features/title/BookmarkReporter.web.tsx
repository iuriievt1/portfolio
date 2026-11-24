'use client'

import { type BookmarkReporterInput, useBookmarkReporter } from './use-bookmark-reporter'

export function BookmarkReporter(props: BookmarkReporterInput) {
	useBookmarkReporter(props)
	return null
}
