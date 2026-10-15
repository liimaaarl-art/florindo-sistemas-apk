import { useEffect, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function useAuthedQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>) {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useQuery({
    queryKey,
    queryFn,
    enabled: mounted && !isPending && !!user,
  });
}
