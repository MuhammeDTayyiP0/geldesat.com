"use client"

import { useEffect, useRef } from "react"

interface ChatPageShellProps {
    children: React.ReactNode
}

/**
 * Wraps the chat page in a fixed-position container that uses the
 * visualViewport API to resize when the mobile keyboard opens/closes.
 * This completely prevents the page-level scroll jump that happens
 * when tapping the input on mobile.
 */
export function ChatPageShell({ children }: ChatPageShellProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const html = document.documentElement
        const body = document.body

        // Save original styles to restore on unmount
        const origHtmlOverflow = html.style.overflow
        const origBodyOverflow = body.style.overflow

        // Lock body scroll completely — the chat container handles all scrolling internally
        html.style.overflow = "hidden"
        body.style.overflow = "hidden"

        const vv = window.visualViewport

        const updateLayout = () => {
            if (!containerRef.current || !vv) return
            // Set container height to the actual visible viewport height
            // This shrinks when the keyboard opens, keeping the input above the keyboard
            containerRef.current.style.height = `${vv.height}px`
            // Adjust top offset in case the browser scrolls the visual viewport
            containerRef.current.style.top = `${vv.offsetTop}px`
        }

        if (vv) {
            updateLayout()
            vv.addEventListener("resize", updateLayout)
            vv.addEventListener("scroll", updateLayout)
        }

        return () => {
            // Restore original body scroll behavior when leaving the chat page
            html.style.overflow = origHtmlOverflow
            body.style.overflow = origBodyOverflow

            if (vv) {
                vv.removeEventListener("resize", updateLayout)
                vv.removeEventListener("scroll", updateLayout)
            }
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className="fixed inset-x-0 top-0 z-50 flex flex-col bg-background overflow-hidden"
            style={{ height: "100dvh" }}
        >
            {children}
        </div>
    )
}
