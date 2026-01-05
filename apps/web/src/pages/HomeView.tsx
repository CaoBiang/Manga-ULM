import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'

export default function HomeView() {
  const { t } = useTranslation()

  return (
    <div>
      <Typography.Paragraph type="secondary" className="mb-0">
        {t('libraryDashboardSubtitle')}
      </Typography.Paragraph>
    </div>
  )
}
