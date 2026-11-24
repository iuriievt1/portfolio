import { createElement, forwardRef } from 'react'
import { vi } from 'vitest'

/** Create a stub component that renders as a named host element for react-test-renderer */
function stub(name: string) {
	const C = forwardRef((props: Record<string, unknown>, ref: unknown) =>
		createElement(name, { ...props, ref } as Record<string, unknown>),
	)
	C.displayName = name
	return C
}

vi.mock('react-native', () => ({
	StyleSheet: {
		create: <T extends Record<string, unknown>>(s: T): T => s,
		flatten: (style: unknown): Record<string, unknown> => {
			if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean))
			if (style && typeof style === 'object') return style as Record<string, unknown>
			return {}
		},
		hairlineWidth: 1,
		absoluteFill: {},
		absoluteFillObject: {},
	},
	Platform: { OS: 'ios', select: <T>(s: { ios?: T; default?: T }) => s.ios ?? s.default, isTV: false },
	Dimensions: {
		get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
		addEventListener: () => ({ remove: () => {} }),
	},
	PixelRatio: {
		get: () => 2,
		getFontScale: () => 1,
		getPixelSizeForLayoutSize: (s: number) => s * 2,
		roundToNearestPixel: (s: number) => Math.round(s * 2) / 2,
	},
	AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
	View: stub('View'),
	Text: stub('Text'),
	TextInput: stub('TextInput'),
	Pressable: stub('Pressable'),
	TouchableOpacity: stub('TouchableOpacity'),
	TouchableHighlight: stub('TouchableHighlight'),
	TouchableWithoutFeedback: stub('TouchableWithoutFeedback'),
	ScrollView: stub('RCTScrollView'),
	FlatList: stub('FlatList'),
	SectionList: stub('SectionList'),
	Image: Object.assign(stub('Image'), {
		getSize: (_uri: string, success: (w: number, h: number) => void) => success(100, 100),
		prefetch: () => Promise.resolve(true),
		resolveAssetSource: () => ({ uri: '', width: 0, height: 0 }),
	}),
	Modal: stub('Modal'),
	Switch: stub('RCTSwitch'),
	ActivityIndicator: stub('ActivityIndicator'),
	SafeAreaView: stub('SafeAreaView'),
	StatusBar: stub('StatusBar'),
	KeyboardAvoidingView: stub('KeyboardAvoidingView'),
	Animated: {
		View: stub('View'),
		Text: stub('Text'),
		Image: stub('Image'),
		ScrollView: stub('RCTScrollView'),
		FlatList: stub('FlatList'),
		Value: class {
			_value: number
			constructor(v: number) {
				this._value = v
			}
			setValue(v: number) {
				this._value = v
			}
			interpolate() {
				return this
			}
		},
		timing: () => ({ start: (cb?: () => void) => cb?.() }),
		spring: () => ({ start: (cb?: () => void) => cb?.() }),
		sequence: () => ({ start: (cb?: () => void) => cb?.() }),
		parallel: () => ({ start: (cb?: () => void) => cb?.() }),
		event: () => () => {},
		createAnimatedComponent: (c: unknown) => c,
	},
	Alert: { alert: () => {} },
	Linking: {
		openURL: () => Promise.resolve(true),
		canOpenURL: () => Promise.resolve(true),
		addEventListener: () => ({ remove: () => {} }),
		getInitialURL: () => Promise.resolve(null),
	},
	Keyboard: { dismiss: () => {}, addListener: () => ({ remove: () => {} }) },
	AccessibilityInfo: {
		isScreenReaderEnabled: () => Promise.resolve(false),
		addEventListener: () => ({ remove: () => {} }),
	},
	useColorScheme: () => 'dark',
	useWindowDimensions: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}))

// Mock native-only modules with unparsable .js files (JSX/Flow)
vi.mock('expo-glass-effect', () => ({
	GlassView: stub('GlassView'),
	isLiquidGlassAvailable: () => false,
}))
