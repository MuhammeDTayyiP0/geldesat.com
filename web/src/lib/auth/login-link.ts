/** Link props for a page that needs sign-in: visitors go to login and come back. */
export function signedInLink<P extends string>(signedIn: boolean, to: P) {
  return signedIn ? ({ to } as const) : ({ to: "/login", search: { redirect: to } } as const);
}
