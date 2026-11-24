import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Terms & Conditions',
	description: 'Terms and conditions for the MK.io platform.',
}

export default function TermsPage() {
	return (
		<div className='px-4 py-16 sm:px-6 lg:px-[77px]'>
			<h1 className='font-semibold text-3xl text-foreground'>Terms &amp; Conditions</h1>
			<p className='mt-4 text-white/60'>By using this service, you agree to the following terms and conditions.</p>
		</div>
	)
}
