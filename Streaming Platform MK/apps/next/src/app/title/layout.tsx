import Script from 'next/script'
import type { PropsWithChildren } from 'react'
import { withBasePath } from '@/utils'

export default function TitleLayout({ children }: PropsWithChildren) {
	return (
		<>
			<link rel='stylesheet' href={withBasePath('/vendor/mkplayer-ui.css')} />
			{children}
			<Script src={withBasePath('/vendor/mkplayer.js')} strategy='afterInteractive' />
		</>
	)
}
