import { Space } from 'antd'
import { useTranslation } from 'react-i18next'
import ReaderBehaviorSettings from '@/components/reader/settings/ReaderBehaviorSettings'
import ReaderTapZonesSettings from '@/components/reader/settings/ReaderTapZonesSettings'
import ReaderUiAppearanceSettings from '@/components/reader/settings/ReaderUiAppearanceSettings'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'

export default function SettingsReaderView() {
  const { t } = useTranslation()
  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('readerBehaviorSettingsTitle')}>
          <ReaderBehaviorSettings />
        </GlassSurface>

        <GlassSurface title={t('readerUiAppearance')}>
          <ReaderUiAppearanceSettings />
        </GlassSurface>

        <GlassSurface title={t('readerTapZonesConfigTitle')}>
          <ReaderTapZonesSettings />
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}
