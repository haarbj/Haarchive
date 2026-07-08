"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/lib/db/client";

export type AuthStatusValue = "loading" | "authenticated" | "unauthenticated";

// Re-checks on every client-side navigation, not just on mount. Components
// using this often live above route content (e.g. the site header) and
// never unmount across navigations, but sign-in/out happen via Server
// Actions using a separate server-side client -- there's no client-side
// event to hear that, so a route change is the signal to re-read the
// (now possibly-changed) session cookie.
export function useAuthStatus(): AuthStatusValue {
  const [status, setStatus] = useState<AuthStatusValue>("loading");
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "authenticated" : "unauthenticated");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  return status;
}
