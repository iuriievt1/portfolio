import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Cookie Policy',
	description: 'Cookie policy for the MK.io platform.',
}

export default function CookiePolicyPage() {
	return (
		<div className='px-4 py-16 sm:px-6 lg:px-[77px]'>
			<h1 className='font-semibold text-3xl text-foreground'>Cookie Policy</h1>
			<p className='mt-4 text-white/60'>This site uses cookies to enhance your browsing experience.</p>
		</div>
	)
}
