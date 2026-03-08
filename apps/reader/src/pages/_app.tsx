import './styles.css'
import 'react-photo-view/dist/react-photo-view.css'

import { LiteralProvider } from '@literal-ui/core'
import { ErrorBoundary } from '@sentry/nextjs'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { RecoilRoot } from 'recoil'

import { Layout, Theme } from '../components'

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()

  if (router.pathname === '/success') return <Component {...pageProps} />

  return (
    <ErrorBoundary fallback={<Fallback />} {...({} as any)}>
      <LiteralProvider {...({} as any)}>
        <RecoilRoot {...({} as any)}>
          <Theme />
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </RecoilRoot>
      </LiteralProvider>
    </ErrorBoundary>
  )
}

const Fallback: React.FC<React.PropsWithChildren<unknown>> = () => {
  return <div>Something went wrong.</div>
}
