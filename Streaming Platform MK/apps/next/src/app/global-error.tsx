'use client'

import { t } from '@pkg/app'
import { ErrorState } from '@pkg/design-system'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html lang='en'>
			<head>
				<link rel='stylesheet' href='https://use.typekit.net/hfo1icl.css' />
			</head>
			<body className='bg-page-bg font-sans text-white'>
				<ErrorState
					title={t('error.connection')}
					message={t('error.connectionMessage')}
					actions={[
						{
							label: t('error.reload'),
							action: () => {
								reset()
								window.location.reload()
							},
							variant: 'primary',
						},
						{ label: t('error.goHome'), action: '/', variant: 'secondary' },
					]}
				/>
			</body>
		</html>
	)
}
