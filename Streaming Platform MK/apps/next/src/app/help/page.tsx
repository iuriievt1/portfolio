import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Help',
	description: 'Get help with the MK.io platform.',
}

export default function HelpPage() {
	return (
		<div className='px-4 py-16 sm:px-6 lg:px-[77px]'>
			<h1 className='font-semibold text-3xl text-foreground'>Help</h1>
			<p className='mt-4 text-white/60'>Need help? Contact our support team for assistance.</p>
		</div>
	)
}
