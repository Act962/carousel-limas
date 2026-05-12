import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { S3 } from "@/lib/s3-client";
import { deleteVideo, getVideoById } from "@/lib/videos";

const schema = z.object({
  videoId: z.string().min(1),
});

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { videoId } = parsed.data;

  const video = await getVideoById(videoId);
  if (!video) {
    return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  }

  // Remove do R2 (ignora erro se já não existir)
  try {
    await S3.send(
      new DeleteObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: video.storageKey,
      }),
    );
  } catch {
    // arquivo pode já não existir no bucket — continua para soft delete
  }

  // Soft delete no banco + decrementa quota
  await deleteVideo(videoId);

  return NextResponse.json({ status: "deleted" });
}
