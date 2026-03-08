import { NextSeo, NextSeoProps } from 'next-seo'
import useTranslation from 'next-translate/useTranslation'

export interface SeoProps extends Omit<NextSeoProps, 'title'> {
  scope?: string
  title?: string
}

export const Seo: React.FC<SeoProps> = ({
  scope,
  title,
  description,
  ...seoProps
}) => {
  const { t } = useTranslation()
  title = title ?? t(`page.${scope}.title`)

  if (!title) {
    throw new Error('Title is empty')
  }

  const TypedNextSeo = NextSeo as any
  return (
    <TypedNextSeo
      title={scope === 'home' ? title : `${title} - Flow`}
      description={description ?? t('desc')}
      {...seoProps}
    />
  )
}
