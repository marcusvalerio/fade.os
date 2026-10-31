import type { MetadataRoute } from "next";
import { urlDoSite } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = urlDoSite();
  return [
    { url: new URL("/", site).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/beta", site).toString(), changeFrequency: "monthly", priority: 0.8 },
  ];
}
