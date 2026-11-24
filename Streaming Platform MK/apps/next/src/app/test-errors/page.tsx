'use client'

import { ErrorState } from '@pkg/design-system'
import { useState } from 'react'

type Preview = 'error' | 'global' | 'notfound' | 'offline' | null

export default function TestErrorsPage() {
	const [preview, setPreview] = useState<Preview>(null)

	if (preview === 'error') {
		return (
			<ErrorState
				title='Something went wrong'
				message="We couldn't load this page. Please try again."
				actions={[{ label: 'Try Again', action: () => setPreview(null) }]}
			/>
		)
	}

	if (preview === 'global') {
		return (
			<ErrorState
				title='Connection Error'
				message='Unable to reach the server. Please check your connection and try again.'
				actions={[{ label: 'Reload', action: () => setPreview(null) }]}
			/>
		)
	}

	if (preview === 'notfound') {
		return (
			<ErrorState
				title='Page Not Found'
				message="The page you're looking for doesn't exist or has been moved."
				actions={[{ label: 'Go Home', action: () => setPreview(null) }]}
			/>
		)
	}

	if (preview === 'offline') {
		return (
			<ErrorState
				title="You're Offline"
				message='Check your internet connection and try again.'
				actions={[{ label: 'Retry', action: () => setPreview(null) }]}
			/>
		)
	}

	return (
		<div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-page-bg px-6'>
			<h1 className='mb-4 font-bold text-2xl text-foreground'>Error State Previews</h1>
			{(
				[
					['error', 'Page Error (error.tsx)'],
					['global', 'Global Error (global-error.tsx)'],
					['notfound', '404 Not Found'],
					['offline', 'Offline State'],
				] as const
			).map(([key, label]) => (
				<button
					key={key}
					type='button'
					onClick={() => setPreview(key)}
					className='min-w-[280px] rounded-lg border border-white/10 bg-surface px-6 py-3 text-foreground transition-colors hover:bg-surface-2'
				>
					{label}
				</button>
			))}
		</div>
	)
}
