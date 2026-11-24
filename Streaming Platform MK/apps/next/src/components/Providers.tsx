'use client'

import { AccountProvider, QueryProvider, StoreProvider } from '@pkg/app/providers'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return (
		<QueryProvider>
			<StoreProvider>
				<AccountProvider>{children}</AccountProvider>
			</StoreProvider>
		</QueryProvider>
	)
}
