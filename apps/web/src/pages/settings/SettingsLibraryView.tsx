import { Space } from 'antd'
import { useTranslation } from 'react-i18next'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import LibraryBrowseSettings from '@/components/library/LibraryBrowseSettings'
import RenameTemplateSettings from '@/components/library/RenameTemplateSettings'
import ScannerSettings from '@/components/library/ScannerSettings'

export default function SettingsLibraryView() {
  const { t } = useTranslation()

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <ScannerSettings />

        <GlassSurface title={t('libraryBrowseSettings')}>
          <LibraryBrowseSettings />
        </GlassSurface>

        <GlassSurface title={t('renameSettings')}>
          <RenameTemplateSettings />
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}

