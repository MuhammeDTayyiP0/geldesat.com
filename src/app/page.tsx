export const dynamic = "force-dynamic"
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "GeldeSat - Türkiye'nin En Büyük İlan Sitesi",
};

import { Hero } from "@/components/home/Hero";
import { CategoryList } from "@/components/home/CategoryList";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { Features } from "@/components/home/Features";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <div className="bg-background">
        <CategoryList />
      </div>
      <FeaturedListings />
      <Features />
    </div>
  );
}
