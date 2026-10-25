import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

/*
 * One quick retry, then show the error. Lists keep retrying on their own
 * while they fail (see lib/query.ts), so a long silent retry chain isn't needed.
 */
export const queryConfig = {
  queries: {
    retry: 1,
  },
} satisfies DefaultOptions;

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryConfig });
}
