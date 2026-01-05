import { Table } from 'antd'
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
  const mergedLocale = emptyText ? { ...(locale || {}), emptyText } : locale

  return (
    <Table<RecordType>
      {...rest}
      className={joinClass('reader-table', className)}
      size="small"
      pagination={pagination ?? false}
      locale={mergedLocale}
    />
  )
}

