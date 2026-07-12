'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  getBrowserAuthPlan,
  loadInitialAuthUser,
} from '@/lib/auth-context-runtime'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const authPlan = getBrowserAuthPlan(
      window.location.hostname,
      process.env.NEXT_PUBLIC_SITE_URL,
      document.cookie,
    )

    for (const removal of authPlan.legacyCookieRemovals) {
      document.cookie = removal
    }

    if (!authPlan.shouldInitialize) return

    let mounted = true
    const supabase = createClient()
    supabaseRef.current = supabase

    void loadInitialAuthUser<User>(() => supabase.auth.getUser()).then((initialUser) => {
      if (!mounted) return
      setUser(initialUser)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      if (supabaseRef.current === supabase) supabaseRef.current = null
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabaseRef.current?.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
