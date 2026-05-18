import { Carousel } from "@/components/carousel";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { listCarouselVideos } from "@/lib/videos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await listCarouselVideos();
  const videos = rows.map((v) => useConstructUrl(v.storageKey));

  return <Carousel videos={videos} />;
}
