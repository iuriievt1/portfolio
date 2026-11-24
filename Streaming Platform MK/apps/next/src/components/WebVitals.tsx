'use client'

import { useEffect } from 'react'
import type { Metric } from 'web-vitals'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

function reportMetric(metric: Metric) {
	if (process.env.NODE_ENV !== 'production') {
		// biome-ignore lint/suspicious/noConsole: web vitals dev reporting
		console.log(`[Web Vitals] ${metric.name}:`, {
			value: metric.value,
			rating: metric.rating,
			delta: metric.delta,
			id: metric.id,
		})
	}
}

export function WebVitals() {
	useEffect(() => {
		onCLS(reportMetric)
		onFCP(reportMetric)
		onINP(reportMetric)
		onLCP(reportMetric)
		onTTFB(reportMetric)
	}, [])

	return null
}
