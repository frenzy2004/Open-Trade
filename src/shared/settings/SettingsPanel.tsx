import { Dialog } from '../ui'
import { useSettings } from './SettingsContext'

export interface SettingsPanelProps {
  readonly open: boolean
  readonly onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="These preferences are stored only in this browser."
    >
      <div className="settings-list">
        <label className="settings-row">
          <span>
            <strong>Sound</strong>
            <small>Music and effects across all three games.</small>
          </span>
          <input
            type="checkbox"
            aria-label="Sound"
            checked={!settings.muted}
            onChange={(event) =>
              updateSettings({ muted: !event.currentTarget.checked })
            }
          />
        </label>
        <label className="settings-row">
          <span>
            <strong>Reduce motion</strong>
            <small>Limits transitions, shake, flashes, and parallax.</small>
          </span>
          <input
            type="checkbox"
            aria-label="Reduce motion"
            checked={settings.reducedMotion}
            onChange={(event) =>
              updateSettings({
                reducedMotion: event.currentTarget.checked,
              })
            }
          />
        </label>
      </div>
    </Dialog>
  )
}
