'use client'

import { useNavItems } from '@pkg/app/hooks/use-hub-registry'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function KidsRedirect() {
	const router = useRouter()
	const { data: items } = useNavItems()

	useEffect(() => {
		if (!items) return
		const kidsItem = items.find((i) => i.label.toLowerCase().includes('kid'))
		router.replace(kidsItem?.href ?? '/hub?slug=kids')
	}, [items, router])

	return <div className='min-h-[40vh]' />
}
