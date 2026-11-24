'use client'

import { useNavItems } from '@pkg/app/hooks/use-hub-registry'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SportsRedirect() {
	const router = useRouter()
	const { data: items } = useNavItems()

	useEffect(() => {
		if (!items) return
		const sportsItem = items.find((i) => i.label.toLowerCase().includes('sport'))
		router.replace(sportsItem?.href ?? '/hub?slug=sports')
	}, [items, router])

	return <div className='min-h-[40vh]' />
}
