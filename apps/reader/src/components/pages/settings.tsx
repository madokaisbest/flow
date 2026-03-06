import Dexie from 'dexie'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

import {
  ColorScheme,
  useColorScheme,
  useTranslation,
} from '@flow/reader/hooks'
import { useSettings } from '@flow/reader/state'
import { WEB_DAV_CONFIG_KEY } from '@flow/reader/sync'

import { Button } from '../Button'
import { Checkbox, Select, TextField } from '../Form'
import { Page } from '../Page'

export const Settings: React.FC = () => {
  const { scheme, setScheme } = useColorScheme()
  const [currentLocale, setCurrentLocale] = useState('en-US')
  const [settings, setSettings] = useSettings()
  const t = useTranslation('settings')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('NEXT_LOCALE')
      if (stored) {
        setCurrentLocale(stored)
      } else {
        const nav = navigator.language
        if (nav.startsWith('zh')) {
          setCurrentLocale('zh-CN')
        } else if (nav.startsWith('ja')) {
          setCurrentLocale('ja-JP')
        }
      }
    } catch { }
  }, [])

  return (
    <Page headline={t('title')}>
      <div className="space-y-6">
        <Item title={t('language')}>
          <Select
            value={currentLocale}
            onChange={(e) => {
              window.localStorage.setItem('NEXT_LOCALE', e.target.value)
              window.location.reload()
            }}
          >
            <option value="en-US">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ja-JP">日本語</option>
          </Select>
        </Item>
        <Item title={t('color_scheme')}>
          <Select
            value={scheme}
            onChange={(e) => {
              setScheme(e.target.value as ColorScheme)
            }}
          >
            <option value="system">{t('color_scheme.system')}</option>
            <option value="light">{t('color_scheme.light')}</option>
            <option value="dark">{t('color_scheme.dark')}</option>
          </Select>
        </Item>
        <Item title={t('text_selection_menu')}>
          <Checkbox
            name={t('text_selection_menu.enable')}
            checked={settings.enableTextSelectionMenu}
            onChange={(e) => {
              setSettings({
                ...settings,
                enableTextSelectionMenu: e.target.checked,
              })
            }}
          />
        </Item>
        <Item title={t('library_sort')}>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Select
                value={settings.librarySortField || 'createdAt'}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    librarySortField: e.target.value as any,
                  })
                }}
              >
                <option value="name">{t('library_sort.name')}</option>
                <option value="createdAt">{t('library_sort.createdAt')}</option>
                <option value="updatedAt">{t('library_sort.updatedAt')}</option>
                <option value="size">{t('library_sort.size')}</option>
              </Select>
              <Select
                value={settings.librarySortOrder || 'desc'}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    librarySortOrder: e.target.value as any,
                  })
                }}
              >
                <option value="asc">{t('library_sort_order.asc')}</option>
                <option value="desc">{t('library_sort_order.desc')}</option>
              </Select>
            </div>
            <Checkbox
              name={t('library_sort_local_first')}
              checked={settings.librarySortLocalFirst ?? true}
              onChange={(e) => {
                setSettings({
                  ...settings,
                  librarySortLocalFirst: e.target.checked,
                })
              }}
            />
          </div>
        </Item>
        <Synchronization />
        <Item title={t('cache')}>
          <Button
            variant="secondary"
            onClick={async () => {
              const names = await Dexie.getDatabaseNames()
              for (const n of names) {
                await Dexie.delete(n)
              }
              window.location.reload()
            }}
          >
            {t('cache.clear')}
          </Button>
        </Item>
      </div>
    </Page>
  )
}

const Synchronization: React.FC = () => {
  const [config, setConfig] = useState({ url: '', username: '', password: '' })
  const t = useTranslation('settings.synchronization')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WEB_DAV_CONFIG_KEY)
      if (stored) {
        setConfig(JSON.parse(stored))
      }
    } catch { }
  }, [])

  const isConfigured = !!config.url && !!config.username && !!config.password

  const testConnection = async () => {
    try {
      const auth = btoa(unescape(encodeURIComponent(`${config.username}:${config.password}`)))
      const baseUrl = config.url.replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/books/`, {
        method: 'PROPFIND',
        headers: {
          Authorization: `Basic ${auth}`,
          Depth: '0'
        }
      })
      if (res.ok || res.status === 404 || res.status === 207) {
        alert(t('connection_successful'))
      } else {
        alert(t('connection_failed') + res.status)
      }
    } catch (e: any) {
      alert(t('connection_error') + e.message)
    }
  }

  return (
    <Item title={t('webdav_sync')}>
      <Select disabled>
        <option value="webdav">WebDAV</option>
      </Select>
      <div className="mt-4 flex flex-col gap-3">
        <TextField
          name={t('webdav_url')}
          value={config.url}
          onChange={(e: any) => setConfig({ ...config, url: e.target.value })}
          placeholder="https://server.com/remote.php/webdav/"
        />
        <TextField
          name={t('username')}
          value={config.username}
          onChange={(e: any) => setConfig({ ...config, username: e.target.value })}
        />
        <TextField
          name={t('password')}
          type="password"
          value={config.password}
          onChange={(e: any) => setConfig({ ...config, password: e.target.value })}
        />
        <div className="mt-2 flex gap-3">
          <Button
            onClick={() => {
              window.localStorage.setItem(WEB_DAV_CONFIG_KEY, JSON.stringify(config))
              window.location.reload()
            }}
          >
            {t('save')}
          </Button>
          <Button variant="secondary" onClick={testConnection}>
            {t('test_connection')}
          </Button>
          {isConfigured && (
            <Button
              variant="secondary"
              onClick={() => {
                window.localStorage.removeItem(WEB_DAV_CONFIG_KEY)
                setConfig({ url: '', username: '', password: '' })
                window.location.reload()
              }}
            >
              {t('logout_clear')}
            </Button>
          )}
        </div>
      </div>
    </Item>
  )
}

interface PartProps {
  title: string
}
const Item: React.FC<PartProps> = ({ title, children }) => {
  return (
    <div>
      <h3 className="typescale-title-small text-on-surface-variant">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

Settings.displayName = 'settings'
