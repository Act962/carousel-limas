"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FileVideo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Video, VideoStatus } from "@/lib/videos";
import { formatBytes } from "@/lib/format";
import { VideoActions } from "@/features/admin/components/video-actions";

// ─── Badge de status ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<VideoStatus, string> = {
  READY: "Pronto",
  PENDING: "Enviando",
  FAILED: "Falhou",
  DELETED: "Excluído",
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  READY:
    "bg-green-500/15 text-green-400 border-green-500/25 hover:bg-green-500/15",
  PENDING:
    "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/15",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/15",
  DELETED:
    "bg-zinc-500/15 text-zinc-500 border-zinc-500/25 hover:bg-zinc-500/15",
};

function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs", STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Linha ordenável ──────────────────────────────────────────────────────────

function SortableRow({ video, onDelete }: { video: Video; onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        video.status === "DELETED" && "opacity-40",
        isDragging && "opacity-50 bg-secondary/40 shadow-lg",
      )}
    >
      <TableCell className="w-8 pr-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs w-8">
        {video.displayOrder + 1}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {video.title ?? video.originalName}
          </span>
          {video.title && (
            <span className="text-xs text-muted-foreground">
              {video.originalName}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={video.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatBytes(video.sizeBytes)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDuration(video.durationSeconds)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {video.width && video.height ? `${video.width}×${video.height}` : "—"}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "text-xs",
            video.isActive && video.status !== "DELETED"
              ? "text-green-400"
              : "text-muted-foreground",
          )}
        >
          {video.isActive && video.status !== "DELETED" ? "Sim" : "Não"}
        </span>
      </TableCell>
      <TableCell>
        <VideoActions video={video} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

interface VideoTableProps {
  videos: Video[];
}

export function VideoTable({ videos: initial }: VideoTableProps) {
  const [videos, setVideos] = useState(initial);

  useEffect(() => {
    setVideos(initial);
  }, [initial]);

  function handleDelete(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(videos, oldIndex, newIndex);

    setVideos(reordered);

    await fetch("/api/videos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((v) => v.id) }),
    });
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border py-16 text-center text-muted-foreground">
        <FileVideo className="h-8 w-8 opacity-30" />
        <p className="text-sm">Nenhum vídeo cadastrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={videos.map((v) => v.id)}
          strategy={verticalListSortingStrategy}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pr-0" />
                <TableHead className="w-8">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Resolução</TableHead>
                <TableHead>Visível</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video) => (
                <SortableRow key={video.id} video={video} onDelete={handleDelete} />
              ))}
            </TableBody>
          </Table>
        </SortableContext>
      </DndContext>
    </div>
  );
}
