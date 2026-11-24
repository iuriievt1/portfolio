// @pkg/design-system — tokens, icons, components

// Utils re-export (convenience)
export { clamp, cn, toPercent } from '@pkg/utils'
// ErrorState
export { ErrorIcon, ErrorState } from './components/features/ErrorState'
export type {
	HeroActions,
	HeroContextValue,
	HeroCta,
	HeroData,
	HeroItemData,
	HeroMeta,
	HeroState,
} from './components/features/Hero'
// Hero compound
export { Hero, useHero, useHeroCarousel } from './components/features/Hero'
export type {
	BackdropItem,
	CardAspect,
	ContinueItem,
	DisplayVisibility,
	HighlightsItem,
	LiveItem,
	MultiviewItem,
	PosterItem,
	RailActions,
	RailContextValue,
	RailData,
	RailDisplay,
	RailFocusState,
	RailHoverState,
	RailItemData,
	RailMeta,
	RailState,
	RailVariant,
	RenderCardFn,
	ResponsiveCols,
	ScheduleItem,
	ShowType,
	SponsoredItem,
} from './components/features/Rail'
// Rail compound
export { CardContent, CardMetaContext, Rail, useRail, useRailDisplay } from './components/features/Rail'
export type { ActiveMenu, AudioTrackOption, TracksState, VideoPlayerProps } from './components/features/VideoPlayer'
// VideoPlayer compound
export {
	useControls,
	usePlayback,
	usePlayer,
	useTracks,
	useVolume,
	VideoPlayer,
} from './components/features/VideoPlayer'
export type { PlayerError } from './components/features/VideoPlayer/types'
// Avatar
export { Avatar } from './components/primitives/Avatar'
// Leaf components
export { Badge, type BadgeIntent, type BadgeProps } from './components/primitives/Badge'
// GlassBackground
export { GlassBackground } from './components/primitives/GlassBackground'
// Image
export { DSImage, type ImageProps } from './components/primitives/Image'
// Icons
export {
	ChevronIcon,
	CloseIcon,
	HomeIcon,
	KidsIcon,
	PlayIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	TrophyIcon,
} from './components/primitives/icons'
// Link
export { Link } from './components/primitives/Link'
export { ProgressBar } from './components/primitives/ProgressBar'
// SearchInput
export { SearchInput } from './components/primitives/SearchInput'
// Skeleton
export { Skeleton, type SkeletonProps } from './components/primitives/Skeleton'
// TruncatedText
export { TruncatedText, type TruncatedTextProps } from './components/primitives/TruncatedText'
// AccountBadge
export { AccountBadge } from './components/ui/AccountBadge'
export type {
	AccountSwitcherItem,
	AccountSwitcherProps,
	AccountSwitcherSection,
} from './components/ui/AccountSwitcher'
// AccountSwitcher
export { AccountSwitcher } from './components/ui/AccountSwitcher'
export type { AppBarItem, AppBarProps } from './components/ui/AppBar'
// AppBar
export { AppBar, AppBarRight } from './components/ui/AppBar'
// FocusRing
export { FocusRing, type FocusRingProps } from './components/ui/FocusRing'
// FocusRingPressable
export { FocusRingPressable, type FocusRingPressableProps } from './components/ui/FocusRingPressable'
export type { FooterLinkProps, FooterProps, FooterSocialIconProps } from './components/ui/Footer'
// Footer (compound: Footer.Copyright, Footer.Nav, Footer.Link, Footer.Social, Footer.SocialIcon)
export { Footer } from './components/ui/Footer'
export { PageContent } from './components/ui/PageContent'
// SafeArea
export { SafeArea } from './components/ui/SafeArea'
// SectionHeader
export { SectionHeader, type SectionHeaderProps } from './components/ui/SectionHeader'
export type { SettingGroupProps, SettingRowProps } from './components/ui/Settings'
// Settings
export { SettingGroup, SettingRow } from './components/ui/Settings'
// Tokens
export {
	APPBAR_H,
	BREAKPOINTS,
	type Breakpoint,
	type CardVariant,
	DURATION,
	EASING,
	type MeasureRect,
	PAGE_PAD,
	PALETTE,
	RAIL,
	rgb,
	TAB_ICON,
} from './tokens'
