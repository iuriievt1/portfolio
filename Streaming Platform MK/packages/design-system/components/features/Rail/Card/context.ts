'use client'

import { createContext, use } from 'react'
import type { RailItemData } from '../types'

export interface CardMeta {
	item: RailItemData
	index: number
}

export const CardMetaContext = createContext<CardMeta | null>(null)

export function useCardMeta(): CardMeta {
	const ctx = use(CardMetaContext)
	if (!ctx) throw new Error('useCardMeta must be used within <Card>')
	return ctx
}
