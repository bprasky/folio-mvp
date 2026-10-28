"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export interface NavigationWorkspace {
  operatingAsOrgId: string | null;
  operatingAsOrg: NavigationOrganization | null;
  organizations: NavigationOrganization[];
  user: { id: string };
}

interface NavigationOrganization {
  id: string;
  name: string;
  logo: string | null;
  type?: string;
  userRole?: string;
}

/** Share live, active memberships; session roles and selected firm IDs can be stale. */
export function useNavigationWorkspace(): NavigationWorkspace | null {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const selectedOrgId = session?.user?.operatingAsOrgId;
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<NavigationWorkspace | null>(null);

  useEffect(() => {
    setWorkspace(null);
    if (!userId) return;
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch("/api/user/workspace-context", {
          cache: "no-store",
          signal: request.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (!request.signal.aborted) {
          setWorkspace(data?.user?.id === userId && Array.isArray(data.organizations) ? data : null);
        }
      } catch {
        if (!request.signal.aborted) setWorkspace(null);
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", load);
    };
  }, [userId, selectedOrgId, pathname]);

  // Never render a previous person's permissions while the new request starts.
  return userId && workspace?.user.id === userId ? workspace : null;
}
