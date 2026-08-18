import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Ücretsiz İlan Ver",
}

export default async function IlanVerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session) {
        redirect("/auth/login?callbackUrl=/ilan-ver");
    }

    return <>{children}</>;
}
