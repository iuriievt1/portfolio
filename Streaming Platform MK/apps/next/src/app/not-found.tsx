'use client'

import { t } from '@pkg/app'
import { ErrorState } from '@pkg/design-system/components/features/ErrorState'

export default function NotFound() {
	return (
		<ErrorState
			title={t('error.notFound')}
			message={t('error.notFoundMessage')}
			actions={[
				{ label: t('error.goBack'), action: () => window.history.back(), variant: 'primary' },
				{ label: t('error.goHome'), action: '/', variant: 'secondary' },
			]}
		/>
	)
}
