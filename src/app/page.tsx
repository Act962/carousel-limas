import { Carousel } from "@/components/carousel";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { listAllVideos } from "@/lib/videos";

export default async function Home() {
  const all = await listAllVideos();
  const videos = all
    .filter((v) => v.status === "READY" && v.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((v) => useConstructUrl(v.storageKey));

  return <Carousel videos={videos} />;
}
