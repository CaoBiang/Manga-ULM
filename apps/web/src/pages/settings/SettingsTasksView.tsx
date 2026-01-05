import { Space } from 'antd'
import { useTranslation } from 'react-i18next'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import TaskManager from '@/components/tasks/TaskManager'
import TaskSettings from '@/components/tasks/TaskSettings'

export default function SettingsTasksView() {
  const { t } = useTranslation()

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('taskSettings')}>
          <TaskSettings />
        </GlassSurface>

        <GlassSurface>
          <TaskManager />
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}

