import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { messages } from '@/locales/messages'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: messages.en },
    zh: { translation: messages.zh }
  },
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false
  }
})

export default i18n

