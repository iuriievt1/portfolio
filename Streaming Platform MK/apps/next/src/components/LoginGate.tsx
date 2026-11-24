'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'demo-auth'
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD

function getIsAuthed() {
	if (typeof window === 'undefined') return false
	return sessionStorage.getItem(STORAGE_KEY) === 'true'
}

function subscribe(callback: () => void) {
	window.addEventListener('storage', callback)
	return () => window.removeEventListener('storage', callback)
}

export function LoginGate({ children }: { children: ReactNode }) {
	// No password configured → skip gate entirely
	if (!DEMO_PASSWORD) return <>{children}</>

	return <Gate>{children}</Gate>
}

function Gate({ children }: { children: ReactNode }) {
	const isAuthed = useSyncExternalStore(subscribe, getIsAuthed, () => false)
	const [mounted, setMounted] = useState(false)
	const [password, setPassword] = useState('')
	const [error, setError] = useState(false)

	useEffect(() => setMounted(true), [])

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault()
			if (password === DEMO_PASSWORD) {
				sessionStorage.setItem(STORAGE_KEY, 'true')
				window.dispatchEvent(new Event('storage'))
				setError(false)
			} else {
				setError(true)
			}
		},
		[password],
	)

	// Static HTML / SSR: render blank page (matches bg) until client checks sessionStorage
	if (!mounted) return <div className='min-h-screen bg-page-bg' />
	if (isAuthed) return <>{children}</>

	return (
		<div className='flex min-h-screen items-center justify-center bg-page-bg'>
			<form onSubmit={handleSubmit} className='flex w-80 flex-col gap-4 rounded-xl bg-white/5 p-8'>
				<h1 className='text-center font-semibold text-white text-xl'>MediaKind Demo</h1>
				<p className='text-center text-sm text-white/50'>Enter password to continue</p>
				<input
					type='password'
					value={password}
					onChange={(e) => {
						setPassword(e.target.value)
						setError(false)
					}}
					placeholder='Password'
					className='rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none'
				/>
				{error && <p className='text-center text-red-400 text-sm'>Incorrect password</p>}
				<button
					type='submit'
					className='rounded-lg bg-white px-4 py-3 font-medium text-black transition-opacity hover:opacity-90'
				>
					Enter
				</button>
			</form>
		</div>
	)
}
