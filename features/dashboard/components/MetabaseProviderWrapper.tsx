"use client"

import React, { useMemo, useEffect, useState } from "react"
import { useMetabaseAuth } from '../context/MetabaseAuthContext'
import { prepareTokenForAlias, clearClientTokenCache } from '../services/metabase'
import { MainLayout } from "@/components/layout/MainLayout"

function ProviderMountLogger({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[MetabaseProviderWrapper] MetabaseProvider mounted')
    return () => {
      // eslint-disable-next-line no-console
      console.log('[MetabaseProviderWrapper] MetabaseProvider unmounted')
    }
  }, [])

  return <>{children}</>
}

interface Props {
  children: React.ReactNode
  /** optional alias string appended to token request e.g. '2' */
  alias?: string
}

export default function MetabaseProviderWrapper({ children, alias: propAlias }: Props) {
  const metabaseUrl = process.env.NEXT_PUBLIC_METABASE_SITE_URL
  const { state, dispatch } = useMetabaseAuth()
  const alias = propAlias ?? state.alias ?? undefined

  if (!metabaseUrl) {
    return (
      <div className="p-8 text-red-600">❌ NEXT_PUBLIC_METABASE_SITE_URL no configurada</div>
    )
  }

  const [providerReady, setProviderReady] = useState(!alias);
  const [fetchedJwt, setFetchedJwt] = useState<string | null>(null);
  const prevAliasRef = React.useRef<string | undefined | null>(undefined)

  // Dynamically load SDK on client to avoid SSR document access
  const [metabaseSdk, setMetabaseSdk] = useState<any | null>(null)
  useEffect(() => {
    let cancelled = false
    import("@metabase/embedding-sdk-react")
      .then((mod) => {
        if (!cancelled) setMetabaseSdk(mod)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[MetabaseProviderWrapper] failed to import metabase sdk', err)
      })
    return () => { cancelled = true }
  }, [])

  // Build authConfig when SDK is available
  const authConfig = useMemo(() => {
    if (!metabaseSdk) return null;

    // Obtener la URL base del entorno actual
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : '';

    const authProviderUri = alias
      ? `${baseUrl}/api/metabase/token?as=${encodeURIComponent(alias)}`
      : `${baseUrl}/api/metabase/token`;

    return metabaseSdk.defineMetabaseAuthConfig({
      metabaseInstanceUrl: metabaseUrl,
      authProviderUri,
      fetchOptions: { credentials: "include" },
    }) as any;
  }, [metabaseSdk, metabaseUrl, alias]);

  // Build theme when SDK is available
  const theme = useMemo(() => {
    if (!metabaseSdk) return null

    return metabaseSdk.defineMetabaseTheme({
      fontFamily: "Lato",
      fontSize: "14px",
      lineHeight: "20px",
      colors: {
        brand: "#21409A",
        "brand-hover": "#3460DE",
        "brand-hover-light": "#6B91FF",
        "text-primary": "#0F1533",
        "text-secondary": "#474D66",
        "text-tertiary": "#808599",
        background: "#FDFDFF",
        "background-light": "#F0F4FF",
        "background-secondary": "#EFF3FF",
        "background-hover": "#FFFFFF",
        "background-disabled": "#B8BCCC",
        border: "#D8DDEF",
        shadow: "rgba(33, 64, 154, 0.15)",
        positive: "#64E386",
        negative: "#F04B4B",
        charts: [
          "#21409A",
          "#FF860D",
          "#3083FF",
          "#2A4FBD",
          "#783FFF",
          "#A7BDFF",
          "#6B91FF",
          "#3460DE",
        ],
      },
      components: {
        dashboard: { backgroundColor: "#F2F3F5", gridBorderColor: "#F2F3F5", card: { backgroundColor: "#FFFFFF", border: "5px outset #F2F3F5" } },
        table: { stickyBackgroundColor: "#F0F4FF", cell: { backgroundColor: "#FFFFFF", textColor: "#0F1533", fontSize: "13px" }, idColumn: { backgroundColor: "#EFF3FF", textColor: "#21409A" } },
        number: { value: { fontSize: "26px", lineHeight: "24px" } },
        cartesian: { padding: "8px 10px", label: { fontSize: "10px" }, splitLine: { lineStyle: { color: "#D8DDEF" } }, goalLine: { label: { fontSize: "12px" } } },
        tooltip: { backgroundColor: "#FFFFFF", focusedBackgroundColor: "#EFF3FF", textColor: "#0F1533", secondaryTextColor: "#474D66" },
        popover: { zIndex: 5 },
        collectionBrowser: { breadcrumbs: { expandButton: { textColor: "#21409A", backgroundColor: "#FFFFFF", hoverTextColor: "#FFFFFF", hoverBackgroundColor: "#21409A" } } },
        question: { backgroundColor: "#FFFFFF", toolbar: { backgroundColor: "#F0F4FF" } }
      }
    })
  }, [metabaseSdk])

  const providerInstanceKey = `${alias ?? 'anon'}-${state.providerKey}`

  useEffect(() => {
    console.log('[MetabaseProviderWrapper] authConfig:', { authConfig, alias, providerKey: state.providerKey });
  }, [authConfig, alias]);

  useEffect(() => {
    const prev = prevAliasRef.current
    if (prev && !alias) {
      clearClientTokenCache()
      dispatch({ type: 'BUMP_KEY' })
    }
    setProviderReady(!alias)
    prevAliasRef.current = alias
  }, [alias, dispatch])

  useEffect(() => {
    if (!alias) return
    let cancelled = false
    async function fetchAndPrepare() {
      console.log('[MetabaseProviderWrapper] starting prepareTokenForAlias for', alias)
      try {
        const jwt = await prepareTokenForAlias(String(alias))
        console.log('[MetabaseProviderWrapper] prepareTokenForAlias finished', { jwt })
        if (cancelled) return
        setFetchedJwt(jwt)
        setTimeout(() => {
          if (!cancelled) setProviderReady(true)
          console.log('[MetabaseProviderWrapper] providerReady set true')
        }, 50)
      } catch (err) {
        console.error('[MetabaseProviderWrapper] failed to prepare alias token', err)
        if (!cancelled) setProviderReady(true)
      }
    }
    fetchAndPrepare()
    return () => { cancelled = true }
  }, [alias]);

  // Ensure SDK loaded and its MetabaseProvider component exists
  const ProviderComponent = metabaseSdk?.MetabaseProvider

  if (!providerReady || !metabaseSdk || !authConfig || !theme || !ProviderComponent) {
    if (metabaseSdk && !ProviderComponent) {
      // eslint-disable-next-line no-console
      console.error('[MetabaseProviderWrapper] MetabaseProvider export not found on SDK module', metabaseSdk)
    }
    return (
      <div className="p-6">
        <div>Preparando sesión de Metabase...</div>
        {fetchedJwt && (
          <div className="mt-2 text-xs text-gray-600">token preview: {String(fetchedJwt).slice(0, 20)}...</div>
        )}
      </div>
    );
  }

  return (
    <ProviderMountLogger>
      <ProviderComponent key={providerInstanceKey} authConfig={authConfig} theme={theme} className="metabase-provider">
        <MainLayout>
          {children}
        </MainLayout>
      </ProviderComponent>
    </ProviderMountLogger>
  )
}