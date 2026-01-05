import { Space } from 'antd'
import { useTranslation } from 'react-i18next'
import ManagerAppearanceSettings from '@/components/glass/settings/ManagerAppearanceSettings'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import LibraryDisplaySettings from '@/components/library/LibraryDisplaySettings'

export default function SettingsDisplayView() {
  const { t } = useTranslation()

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('libraryDisplaySettings')}>
          <LibraryDisplaySettings />
        </GlassSurface>

        <GlassSurface title={t('managerUiAppearance')}>
          <ManagerAppearanceSettings />
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}

