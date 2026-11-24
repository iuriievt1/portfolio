import { Audio } from './Audio/Audio.web'
import { BackButton } from './BackButton/BackButton.web'
import { Controls } from './Controls/Controls.web'
import { PlayerError } from './Error/Error.web'
import { Fullscreen } from './Fullscreen/Fullscreen.web'
import { Ghost } from './Ghost/Ghost.web'
import { Loading } from './Loading/Loading.web'
import { AudioMenu } from './Menus/AudioMenu.web'
import { CCMenu } from './Menus/CCMenu.web'
import { QualityMenu } from './Menus/QualityMenu.web'
import { SpeedMenu } from './Menus/SpeedMenu.web'
import { MultiView } from './MultiView/MultiView.web'
import { Overlay } from './Overlay/Overlay.web'
import { PlayPause } from './PlayPause/PlayPause.web'
import { VideoPlayer as VideoPlayerRoot } from './Root/VideoPlayer.web'
import { SubtitleOverlay } from './SubtitleOverlay/SubtitleOverlay.web'
import { Subtitles } from './Subtitles/Subtitles.web'
import { Time } from './Time/Time.web'
import { Timeline } from './Timeline/Timeline.web'
import { Title } from './Title/Title.web'
import { Volume } from './Volume/Volume.web'

export const VideoPlayer = Object.assign(VideoPlayerRoot, {
	Overlay,
	Controls,
	Timeline,
	PlayPause,
	Ghost,
	Volume,
	BackButton,
	Title,
	Time,
	Fullscreen,
	MultiView,
	Subtitles,
	Audio,
	QualityMenu,
	SpeedMenu,
	CCMenu,
	AudioMenu,
	SubtitleOverlay,
	Loading,
	Error: PlayerError,
})

export type { AudioTrackOption, TracksState } from './context'
export { useControls } from './hooks/use-controls'
export { usePlayback } from './hooks/use-playback'
export { usePlayer } from './hooks/use-player'
export { useTracks } from './hooks/use-tracks'
export { useVolume } from './hooks/use-volume'
export type { ActiveMenu, PlayerError, VideoPlayerProps } from './types'
