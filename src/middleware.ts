import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req
    const isLoggedIn = !!req.auth?.user
    const user = req.auth?.user

    console.log("Middleware Debug:", {
        path: nextUrl.pathname,
        isLoggedIn,
        hasUser: !!user,
        phoneCallback: user?.phoneNumber
    })

    const isPhoneNumberMissing = isLoggedIn && !user?.phoneNumber

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
    const isCompleteProfileRoute = nextUrl.pathname === "/auth/complete-profile"

    // 1. Allow API Auth routes always
    if (isApiAuthRoute) {
        return
    }

    // EDGE CASE: If user is NOT logged in but tries to access complete-profile, 
    // redirect them to login (or home) because they shouldn't be here.
    if (!isLoggedIn && isCompleteProfileRoute) {
        return Response.redirect(new URL("/auth/login", nextUrl))
    }

    // 2. If phone is missing, force redirect to complete-profile
    // unless they are already there or signing out
    if (isPhoneNumberMissing) {
        if (!isCompleteProfileRoute && nextUrl.pathname !== "/api/auth/signout") {
            return Response.redirect(new URL("/auth/complete-profile", nextUrl))
        }
        return // Allow access to complete-profile
    }

    // 3. If phone IS present, prevent access to complete-profile (redirect to home)
    if (isLoggedIn && !isPhoneNumberMissing && isCompleteProfileRoute) {
        return Response.redirect(new URL("/", nextUrl))
    }

    // 4. Existing protected route logic
    const isProtectedRoute =
        nextUrl.pathname.startsWith("/ilan-ver") ||
        nextUrl.pathname.startsWith("/profile") ||
        nextUrl.pathname.startsWith("/messages") ||
        nextUrl.pathname.startsWith("/my-listings") ||
        nextUrl.pathname.startsWith("/favorites")

    if (isProtectedRoute && !isLoggedIn) {
        let callbackUrl = nextUrl.pathname
        if (nextUrl.search) {
            callbackUrl += nextUrl.search
        }

        const encodedCallbackUrl = encodeURIComponent(callbackUrl)
        return Response.redirect(new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl))
    }
})

export const config = {
    matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
