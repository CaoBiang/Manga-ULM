import { Space } from 'antd'
import { useTranslation } from 'react-i18next'
import ReaderImageRenderSettings from '@/components/reader/settings/ReaderImageRenderSettings'
import ReaderPagingSettings from '@/components/reader/settings/ReaderPagingSettings'
import ReaderPreloadSettings from '@/components/reader/settings/ReaderPreloadSettings'
import ReaderTapZonesSettings from '@/components/reader/settings/ReaderTapZonesSettings'
import ReaderToolbarSettings from '@/components/reader/settings/ReaderToolbarSettings'
import ReaderUiAppearanceSettings from '@/components/reader/settings/ReaderUiAppearanceSettings'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'

export default function SettingsReaderView() {
  const { t } = useTranslation()
  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('readerPagingSettingsTitle')}>
          <ReaderPagingSettings />
        </GlassSurface>

        <GlassSurface title={t('readerPreloadSettingsTitle')}>
          <ReaderPreloadSettings />
        </GlassSurface>

        <GlassSurface title={t('readerImageRenderSettingsTitle')}>
          <ReaderImageRenderSettings />
        </GlassSurface>

        <GlassSurface title={t('readerToolbarSettingsTitle')}>
          <ReaderToolbarSettings />
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
