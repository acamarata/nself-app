export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'ɳDemo',
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || 'Your application tagline',
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'A production-ready demo showcasing ɳSelf backend platform',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',

  branding: {
    icon: '/icon.svg',
    logo: '/logo.svg',
    logoAlt: '/logo-dark.svg',
    favicon: '/icon.svg',
    ogImage: '/og-image.svg',
    appleTouchIcon: '/apple-touch-icon.svg',
  },

  theme: {
    primaryColor: '#1a1a2e',
    accentColor: '#0ea5e9',
  },

  social: {
    twitter: '',
    github: '',
    discord: '',
    linkedin: '',
  },

  contact: {
    email: '',
    support: '',
  },

  legal: {
    privacyUrl: '/privacy',
    termsUrl: '/terms',
    company: '',
  },

  features: {
    analytics: false,
    newsletter: false,
    blog: false,
  },

  seo: {
    titleTemplate: '%s | ɳDemo',
    defaultTitle: 'ɳDemo',
    keywords: ['ɳself', 'ɳdemo', 'demo app', 'nextjs', 'react', 'hasura', 'postgres', 'graphql', 'realtime'],
    author: '',
  },
} as const;

export type AppConfig = typeof appConfig;
