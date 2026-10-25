/** Route paths, so links and the router can't drift apart. */
export const paths = {
  home: { path: "/", getHref: () => "/" },
} as const;
