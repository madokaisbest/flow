import { useCallback, useState, useEffect } from 'react'

import locales from '../../locales'

export function useTranslation(scope?: string) {
  const [locale, setLocale] = useState<'en-US' | 'zh-CN' | 'ja-JP'>('en-US')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('NEXT_LOCALE')
      if (stored && (stored === 'en-US' || stored === 'zh-CN' || stored === 'ja-JP')) {
        setLocale(stored)
      } else {
        const nav = navigator.language
        if (nav.startsWith('zh')) {
          setLocale('zh-CN')
        } else if (nav.startsWith('ja')) {
          setLocale('ja-JP')
        }
      }
    } catch { }
  }, [])

  return useCallback(
    (key: string) => {
      // @ts-ignore
      return locales[locale][scope ? `${scope}.${key}` : key] as string
    },
    [locale, scope],
  )
}
