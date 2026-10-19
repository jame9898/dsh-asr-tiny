import { useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { DEFAULT_ASR_BASE } from '../config.ts'
import { readAsrBase, writeAsrBase } from './prefs.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'voice.collector'>

/** Plugin settings card: where the browser half reaches the local ASR service. */
export function SettingsCard({ t }: SettingsCardProps) {
  const [value, setValue] = useState(readAsrBase())
  const [saved, setSaved] = useState(false)

  const save = (): void => {
    writeAsrBase(value)
    setValue(readAsrBase())
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className={css.card}>
      <label className={css.label} htmlFor="dsh-plugin-asr-zh-tiny-asr-base">
        {t('settingsAsrBase')}
      </label>
      <div className={css.row}>
        <input
          id="dsh-plugin-asr-zh-tiny-asr-base"
          className={css.input}
          value={value}
          placeholder={DEFAULT_ASR_BASE}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" className={css.save} onClick={save}>
          {t('settingsSave')}
        </button>
      </div>
      <p className={css.hint}>{saved ? t('settingsSaved') : t('settingsHint')}</p>
    </div>
  )
}
