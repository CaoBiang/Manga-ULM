import { Badge, Button, Empty, Input, List, Menu, Popover, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import type { TagType } from '@/components/tags/TagTypeManager'

export type SimpleTag = {
  id: number
  name: string
  type_id: number
}

type TagListResponse = {
  tags: SimpleTag[]
}

export type TagSelectorProps = {
  value: SimpleTag[]
  onChange: (value: SimpleTag[]) => void
  disabled?: boolean
}

const badgeToneClasses = Object.freeze([
  'manager-badge--blue',
  'manager-badge--cyan',
  'manager-badge--green',
  'manager-badge--orange',
  'manager-badge--purple',
  'manager-badge--red'
])

const badgeToneClass = (typeId: number) => {
  const id = Number(typeId)
  if (!Number.isFinite(id)) {
    return badgeToneClasses[0]
  }
  return badgeToneClasses[Math.abs(id) % badgeToneClasses.length]
}

export default function TagSelector({ value, onChange, disabled = false }: TagSelectorProps) {
  const { t } = useTranslation()

  const [allTags, setAllTags] = useState<SimpleTag[]>([])
  const [allTagTypes, setAllTagTypes] = useState<TagType[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')

  const selectedTags = value || []

  const filterButtonLabel = useMemo(() => {
    if (!selectedTags.length) {
      return t('filterByTags')
    }
    return `${t('filterByTags')} (${selectedTags.length})`
  }, [selectedTags.length, t])

  const tagsByTypeCount = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tag of allTags) {
      map[tag.type_id] = (map[tag.type_id] || 0) + 1
    }
    return map
  }, [allTags])

  const ensureActiveType = useMemo(() => {
    if (activeTypeId && allTagTypes.some((type) => type.id === activeTypeId)) {
      return activeTypeId
    }
    return allTagTypes[0]?.id ?? null
  }, [activeTypeId, allTagTypes])

  useEffect(() => {
    setActiveTypeId(ensureActiveType)
  }, [ensureActiveType])

  const loadData = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [tagsResponse, typesResponse] = await Promise.all([
        http.get('/api/v1/tags', { params: { per_page: 0 } }),
        http.get('/api/v1/tag-types')
      ])
      const tags = ((tagsResponse?.data as TagListResponse | undefined)?.tags || []) as SimpleTag[]
      setAllTags(tags)
      setAllTagTypes((typesResponse?.data || []) as TagType[])
    } catch (error) {
      console.error('加载标签数据失败：', error)
      setLoadError((error as any)?.response?.data?.error || (error as any)?.message || t('errorFetchingTags'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    if (allTags.length || loading) return
    loadData().catch(() => {})
  }, [allTags.length, loading, open])

  const tagsOfActiveType = useMemo(() => {
    if (!activeTypeId) return allTags
    return allTags.filter((tag) => tag.type_id === activeTypeId)
  }, [activeTypeId, allTags])

  const filteredTags = useMemo(() => {
    const keyword = tagSearch.trim().toLowerCase()
    if (!keyword) {
      return tagsOfActiveType
    }
    return tagsOfActiveType.filter((tag) => tag.name.toLowerCase().includes(keyword))
  }, [tagSearch, tagsOfActiveType])

  const isTagSelected = (tag: SimpleTag) => selectedTags.some((item) => item.id === tag.id)

  const toggleTag = (tag: SimpleTag) => {
    if (isTagSelected(tag)) {
      onChange(selectedTags.filter((item) => item.id !== tag.id))
      return
    }
    onChange(selectedTags.concat([tag]))
  }

  const clearSelection = () => {
    if (!selectedTags.length) return
    onChange([])
  }

  const menuItems = useMemo(
    () =>
      allTagTypes.map((type) => ({
        key: String(type.id),
        label: (
          <span className="tag-selector-panel__menu-item">
            <span>{type.name}</span>
            <Badge count={tagsByTypeCount[type.id] || 0} className={`manager-badge ${badgeToneClass(type.id)}`} />
          </span>
        )
      })),
    [allTagTypes, tagsByTypeCount]
  )

  return (
    <Popover
      placement="bottomLeft"
      trigger="click"
      open={open}
      onOpenChange={(next) => setOpen(next)}
      overlayClassName="tag-selector-overlay"
      content={
        <div className="tag-selector-panel" onClick={(event) => event.stopPropagation()}>
          <Spin spinning={loading}>
            {loadError ? (
              <div className="py-6">
                <Typography.Text type="danger">{loadError}</Typography.Text>
                <div className="mt-3">
                  <Button type="primary" size="small" onClick={() => loadData().catch(() => {})}>
                    {t('retry')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="tag-selector-panel__header">
                  <Typography.Text strong>{t('filterByTags')}</Typography.Text>
                  <Space size="small">
                    <Tooltip title={t('tagFilterClearTooltip')}>
                      <Button type="link" size="small" onClick={clearSelection} disabled={!selectedTags.length}>
                        {t('tagFilterClear')}
                      </Button>
                    </Tooltip>
                    <Button type="primary" size="small" ghost onClick={() => setOpen(false)}>
                      {t('tagFilterDone')}
                    </Button>
                  </Space>
                </div>

                <Input.Search
                  value={tagSearch}
                  size="small"
                  allowClear
                  placeholder={t('searchTagsPlaceholder')}
                  className="tag-selector-panel__search"
                  onChange={(event) => setTagSearch(event.target.value)}
                />

                <div className="tag-selector-panel__body">
                  <div className="tag-selector-panel__types">
                    {!allTagTypes.length ? (
                      <Empty description={t('tagTypesEmpty')} />
                    ) : (
                      <Menu
                        mode="inline"
                        selectedKeys={activeTypeId ? [String(activeTypeId)] : []}
                        items={menuItems}
                        onClick={(info) => setActiveTypeId(Number(info.key))}
                      />
                    )}
                  </div>

                  <div className="tag-selector-panel__tags">
                    {!filteredTags.length ? (
                      <Empty description={t('tagsEmpty')} />
                    ) : (
                      <List
                        dataSource={filteredTags}
                        size="small"
                        split={false}
                        className="tag-selector-panel__tag-list"
                        renderItem={(item) => (
                          <List.Item className="tag-selector-panel__tag">
                            <Tag.CheckableTag checked={isTagSelected(item)} onChange={() => toggleTag(item)}>
                              {item.name}
                            </Tag.CheckableTag>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                </div>

                {selectedTags.length ? (
                  <div className="tag-selector-panel__footer">
                    <Typography.Text type="secondary">{t('tagFilterSelectedCount', { count: selectedTags.length })}</Typography.Text>
                    <Space wrap className="mt-2">
                      {selectedTags.map((tag) => (
                        <Tag key={`selected-tag-${tag.id}`} color="blue" closable onClose={(event) => {
                          event.preventDefault()
                          toggleTag(tag)
                        }}>
                          {tag.name}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ) : null}
              </>
            )}
          </Spin>
        </div>
      }
    >
      <Button disabled={disabled}>
        <FilterOutlined />
        <span className="ml-2">{filterButtonLabel}</span>
      </Button>
    </Popover>
  )
}

