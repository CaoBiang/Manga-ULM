import { ConfigProvider, Empty, Table } from 'antd'
import type { TableProps } from 'antd'

export type ReaderTableProps<RecordType extends object> = TableProps<RecordType> & {
  emptyText?: string
}

const joinClass = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export default function ReaderTable<RecordType extends object>({
  emptyText,
  className,
  pagination,
  locale,
  ...rest
}: ReaderTableProps<RecordType>) {
  const mergedLocale = emptyText
    ? {
        ...(locale || {}),
        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      }
    : locale

  return (
    <ConfigProvider
      theme={{
        inherit: true,
        token: {
          colorBgContainer: 'var(--reader-ui-table-bg, rgba(18, 18, 18, 0.72))',
          colorText: 'rgba(255, 255, 255, 0.92)',
          colorTextSecondary: 'rgba(255, 255, 255, 0.72)',
          colorBorderSecondary: 'var(--reader-ui-table-border, rgba(255, 255, 255, 0.2))'
        },
        components: {
          Table: {
            headerBg: 'rgba(255, 255, 255, 0.06)',
            headerColor: 'rgba(255, 255, 255, 0.92)',
            borderColor: 'var(--reader-ui-table-border, rgba(255, 255, 255, 0.2))',
            rowHoverBg: 'rgba(255, 255, 255, 0.08)',
            rowSelectedBg: 'rgba(255, 255, 255, 0.12)',
            rowSelectedHoverBg: 'rgba(255, 255, 255, 0.14)',
            footerBg: 'transparent',
            footerColor: 'rgba(255, 255, 255, 0.8)'
          }
        }
      }}
    >
      <Table<RecordType>
        {...rest}
        className={joinClass('reader-table', className)}
        size="small"
        pagination={pagination ?? false}
        locale={mergedLocale}
      />
    </ConfigProvider>
  )
}
