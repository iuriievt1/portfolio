'use client'

import { t } from '@pkg/app'
import { ErrorState } from '@pkg/design-system'
import { useEffect } from 'react'

export default function ErrorPage({
	error,
	reset,
}: {
	error: globalThis.Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		// biome-ignore lint/suspicious/noConsole: error boundary should log to console
		console.error('[ErrorPage]', error)
	}, [error])

	return (
		<ErrorState
			title={t('error.generic')}
			message={t('error.genericMessage')}
			actions={[
				{ label: t('error.tryAgain'), action: reset, variant: 'primary' },
				{ label: t('error.goHome'), action: '/', variant: 'secondary' },
			]}
		/>
	)
}
