import React from 'react'
import { Pressable, Text, View } from 'react-native'

type ErrorFallbackProps = {
	error: Error | null
	onRetry: () => void
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212' }}>
			<Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Something went wrong</Text>
			<Text
				style={{
					color: 'rgba(255,255,255,0.6)',
					fontSize: 14,
					marginTop: 8,
					textAlign: 'center',
					paddingHorizontal: 32,
				}}
			>
				{error?.message ?? 'An unexpected error occurred.'}
			</Text>
			<Pressable
				onPress={onRetry}
				style={({ pressed }) => ({
					marginTop: 24,
					paddingHorizontal: 32,
					paddingVertical: 12,
					borderRadius: 4,
					backgroundColor: 'rgba(255,255,255,0.15)',
					opacity: pressed ? 0.8 : 1,
				})}
			>
				<Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
			</Pressable>
		</View>
	)
}

type Props = {
	children: React.ReactNode
	fallback?: React.ReactNode
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

type State = {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
	state: State = { hasError: false, error: null }

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.props.onError?.(error, errorInfo)
	}

	private handleRetry = () => {
		this.setState({ hasError: false, error: null })
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback
			return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
		}
		return this.props.children
	}
}
