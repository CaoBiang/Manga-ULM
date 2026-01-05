import { Empty, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import MangaCard, { type MangaItem } from '@/components/library/MangaCard'
import MangaGrid from '@/components/library/MangaGrid'

export default function LikeView() {
  const { t } = useTranslation()
  const [likedItems, setLikedItems] = useState<MangaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchLikes = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await http.get('/api/v1/likes')
      const list = (response?.data || []) as MangaItem[]
      setLikedItems(list.map((item) => ({ ...item, is_liked: true })))
    } catch (error) {
      console.error('加载喜欢列表失败：', error)
      const messageText = (error as any)?.response?.data?.error || t('loadingWishlist')
      setErrorMessage(String(messageText))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLikes().catch(() => {})
  }, [])

  return (
    <GlassPage>
      <GlassSurface>
        {loading ? (
          <div className="w-full flex justify-center py-10">
            <Spin />
          </div>
        ) : errorMessage ? (
          <Empty description={errorMessage} className="py-12" />
        ) : likedItems.length ? (
          <MangaGrid>
            {likedItems.map((manga) => (
              <MangaCard key={manga.id} manga={manga} hideWishlistButton viewMode="grid" />
            ))}
          </MangaGrid>
        ) : (
          <Empty description={t('wishlistEmpty')} className="py-12" />
        )}
      </GlassSurface>
    </GlassPage>
  )
}

