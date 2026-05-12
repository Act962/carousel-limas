import type { Video, VideoStatus } from "@/generated/prisma/client";
import { db } from "./db";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StorageQuotaInfo = {
  usedBytes: bigint;
  limitBytes: bigint;
  availableBytes: bigint;
  usedPercent: number;
};

export type CreateVideoInput = {
  title?: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
  durationSeconds?: number;
  width?: number;
  height?: number;
  displayOrder?: number;
};

export type { Video, VideoStatus };

// ─── Storage Quota ────────────────────────────────────────────────────────────

/**
 * Retorna o estado atual da quota de storage.
 * Inicializa o singleton se ainda não existir.
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo> {
  const quota = await db.storageQuota.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  const availableBytes =
    quota.limitBytes - quota.usedBytes > 0n
      ? quota.limitBytes - quota.usedBytes
      : 0n;

  const usedPercent =
    quota.limitBytes > 0n
      ? Number((quota.usedBytes * 10000n) / quota.limitBytes) / 100
      : 0;

  return {
    usedBytes: quota.usedBytes,
    limitBytes: quota.limitBytes,
    availableBytes,
    usedPercent,
  };
}

/**
 * Verifica se há espaço disponível para um novo arquivo.
 */
export async function canUpload(sizeBytes: bigint): Promise<boolean> {
  const { availableBytes } = await getStorageQuota();
  return sizeBytes <= availableBytes;
}

// ─── Leitura de Vídeos ────────────────────────────────────────────────────────

/**
 * Vídeos prontos para exibição no carrossel, ordenados por displayOrder.
 */
export async function listCarouselVideos(): Promise<Video[]> {
  return db.video.findMany({
    where: {
      status: "READY",
      isActive: true,
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * Todos os vídeos para o painel admin (sem filtro de status).
 */
export async function listAllVideos(): Promise<Video[]> {
  return db.video.findMany({
    orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Busca um vídeo por ID.
 */
export async function getVideoById(id: string): Promise<Video | null> {
  return db.video.findUnique({ where: { id } });
}

// ─── Escrita de Vídeos ────────────────────────────────────────────────────────

/**
 * Registra um novo vídeo e incrementa a quota de storage atomicamente.
 * Lança erro se não houver espaço suficiente.
 */
export async function createVideo(data: CreateVideoInput): Promise<Video> {
  const hasSpace = await canUpload(data.sizeBytes);
  if (!hasSpace) {
    throw new Error(
      `Storage insuficiente. Tamanho do arquivo: ${formatBytes(data.sizeBytes)}.`,
    );
  }

  return db.$transaction(async (tx) => {
    const video = await tx.video.create({
      data: {
        title: data.title,
        originalName: data.originalName,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        durationSeconds: data.durationSeconds,
        width: data.width,
        height: data.height,
        displayOrder: data.displayOrder ?? 0,
        status: "PENDING",
      },
    });

    await tx.storageQuota.upsert({
      where: { id: 1 },
      create: { id: 1, usedBytes: data.sizeBytes },
      update: { usedBytes: { increment: data.sizeBytes } },
    });

    return video;
  });
}

/**
 * Atualiza o status de um vídeo (ex: PENDING → READY ou FAILED).
 */
export async function updateVideoStatus(
  id: string,
  status: VideoStatus,
): Promise<Video> {
  return db.video.update({
    where: { id },
    data: { status },
  });
}

/**
 * Atualiza metadados opcionais de um vídeo (título, dimensões, duração).
 */
export async function updateVideoMeta(
  id: string,
  meta: Partial<Pick<Video, "title" | "durationSeconds" | "width" | "height" | "isActive">>,
): Promise<Video> {
  return db.video.update({ where: { id }, data: meta });
}

/**
 * Soft delete: marca o vídeo como DELETED e decrementa a quota atomicamente.
 */
export async function deleteVideo(id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const video = await tx.video.findUniqueOrThrow({ where: { id } });

    if (video.status === "DELETED") return;

    await tx.video.update({
      where: { id },
      data: {
        status: "DELETED",
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await tx.storageQuota.upsert({
      where: { id: 1 },
      create: { id: 1, usedBytes: 0n },
      update: {
        usedBytes: { decrement: video.sizeBytes },
      },
    });
  });
}

/**
 * Reordena os vídeos do carrossel de acordo com a lista de IDs fornecida.
 * O índice do array define o novo displayOrder.
 */
export async function reorderVideos(orderedIds: string[]): Promise<void> {
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.video.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

/**
 * Formata bytes em string legível (KB, MB, GB).
 */
export function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
