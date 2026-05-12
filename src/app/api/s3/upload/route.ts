import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { S3 } from "@/lib/s3-client";
import { canUpload, createVideo } from "@/lib/videos";

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive(),
  title: z.string().optional(),
});

function missingEnvVars() {
  const missing: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missing.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES)
    missing.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");
  return missing;
}

export async function POST(req: Request) {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `R2 não configurado. Defina: ${missing.join(", ")}` },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { filename, contentType, size, title } = parsed.data;
  const sizeBytes = BigInt(size);

  const hasSpace = await canUpload(sizeBytes);
  if (!hasSpace) {
    return NextResponse.json(
      { error: "Quota de storage excedida (limite de 10 GB atingido)." },
      { status: 413 },
    );
  }

  const extension = filename.split(".").pop() ?? "mp4";
  const key = `${uuidv4()}.${extension}`;

  // Cria o registro PENDING no banco (já incrementa quota atomicamente)
  const video = await createVideo({
    title,
    originalName: filename,
    storageKey: key,
    mimeType: contentType,
    sizeBytes,
  });

  const command = new PutObjectCommand({
    Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });

  return NextResponse.json({ presignedUrl, key, videoId: video.id });
}
