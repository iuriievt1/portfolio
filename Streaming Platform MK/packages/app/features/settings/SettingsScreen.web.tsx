'use client'

import { SettingGroup, SettingRow } from '@pkg/design-system'
import { useState } from 'react'
import { t } from '../../i18n'

export function SettingsScreen() {
	const [autoplay, setAutoplay] = useState(true)
	const [notifications, setNotifications] = useState(true)
	const [subtitles, setSubtitles] = useState(false)
	const [hdr, setHdr] = useState(true)

	return (
		<div className='mx-auto max-w-2xl px-[var(--page-pad-sm)] py-8 lg:px-[var(--page-pad-lg)]'>
			<h1 className='font-bold text-2xl text-white'>{t('settings.title')}</h1>

			<SettingGroup title={t('settings.playback')}>
				<SettingRow
					label={t('settings.autoplay')}
					description={t('settings.autoplayDesc')}
					value={autoplay}
					onToggle={setAutoplay}
				/>
				<SettingRow
					label={t('settings.defaultSubtitles')}
					description={t('settings.subtitlesDesc')}
					value={subtitles}
					onToggle={setSubtitles}
				/>
				<SettingRow label={t('settings.hdr')} description={t('settings.hdrDesc')} value={hdr} onToggle={setHdr} />
			</SettingGroup>

			<SettingGroup title={t('settings.general')}>
				<SettingRow
					label={t('settings.notifications')}
					description={t('settings.notificationsDesc')}
					value={notifications}
					onToggle={setNotifications}
				/>
			</SettingGroup>

			<p className='mt-8 text-center text-sm text-white/30'>{t('settings.version')}</p>
		</div>
	)
}
