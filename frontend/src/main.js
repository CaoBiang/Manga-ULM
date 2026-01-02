import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from './locales'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import { useUiSettingsStore } from './store/uiSettings'
import { useAppSettingsStore } from './store/appSettings'

async function bootstrap() {
  const app = createApp(App)

  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.use(Antd)

  const i18n = createI18n({
    legacy: false,
    locale: 'zh',
    fallbackLocale: 'zh',
    messages
  })

  app.use(i18n)

  const appSettingsStore = useAppSettingsStore(pinia)
  await appSettingsStore.ensureLoaded()
  i18n.global.locale.value = appSettingsStore.language
  if (typeof document !== 'undefined') {
    document.documentElement.lang = appSettingsStore.language
  }

  useUiSettingsStore(pinia).ensureLoaded()

  app.mount('#app')
}

bootstrap()
