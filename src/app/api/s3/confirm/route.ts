import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteVideo, updateVideoStatus } from "@/lib/videos";

const schema = z.object({
  videoId: z.string().min(1),
  failed: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { videoId, failed } = parsed.data;

  if (failed) {
    // Marca como FAILED e decrementa quota atomicamente via deleteVideo
    await deleteVideo(videoId);
    return NextResponse.json({ status: "failed" });
  }

  const video = await updateVideoStatus(videoId, "READY");
  return NextResponse.json({ status: "ready", videoId: video.id });
}
