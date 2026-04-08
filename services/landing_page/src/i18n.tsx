import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import translations, { type Locale } from './translations'

function detectLocale(): Locale {
  const saved = localStorage.getItem('locale')
  if (saved === 'en' || saved === 'he') return saved
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (tz === 'Asia/Jerusalem') return 'he'
  if (navigator.language.startsWith('he')) return 'he'
  return 'en'
}

const I18nContext = createContext<{
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}>({ locale: 'en', setLocale: () => {}, t: (k) => k })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = (l: Locale) => {
    localStorage.setItem('locale', l)
    setLocaleState(l)
  }

  const t = (key: string) => translations[locale][key] ?? key

  useEffect(() => {
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
    document.title = t('title')
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
