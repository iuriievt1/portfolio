import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { LoginGate, NavShell, Providers, WebVitals } from '@/components'

export const metadata: Metadata = {
	title: {
		default: 'MediaKind Streaming',
		template: '%s | MediaKind Streaming',
	},
	description: 'Stream movies, series, sports, and live TV across all your devices.',
	metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mediakind.app'),
	openGraph: {
		type: 'website',
		siteName: 'MediaKind Streaming',
	},
}

export const viewport: Viewport = {
	themeColor: '#0a0a0a',
	width: 'device-width',
	initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<link rel='stylesheet' href='https://use.typekit.net/hfo1icl.css' />
			</head>
			<body className='bg-page-bg font-sans text-white'>
				<WebVitals />
				<LoginGate>
					<Providers>
						<Suspense fallback={<div className='min-h-screen' />}>
							<NavShell>{children}</NavShell>
						</Suspense>
					</Providers>
				</LoginGate>
			</body>
		</html>
	)
}
