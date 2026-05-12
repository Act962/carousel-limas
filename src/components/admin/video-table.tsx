import type { Video, VideoStatus } from "@/lib/videos";
import { formatBytes } from "@/lib/videos";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Badge de status ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<VideoStatus, string> = {
  READY: "Pronto",
  PENDING: "Enviando",
  FAILED: "Falhou",
  DELETED: "Excluído",
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  READY: "bg-green-500/15 text-green-400 border-green-500/25 hover:bg-green-500/15",
  PENDING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/15",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/15",
  DELETED: "bg-zinc-500/15 text-zinc-500 border-zinc-500/25 hover:bg-zinc-500/15",
};

function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <Badge variant="outline" className={cn("text-xs", STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Tabela ───────────────────────────────────────────────────────────────────

interface VideoTableProps {
  videos: Video[];
}

export function VideoTable({ videos }: VideoTableProps) {
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
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8">#</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tamanho</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Resolução</TableHead>
            <TableHead>Visível</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow
              key={video.id}
              className={cn(video.status === "DELETED" && "opacity-40")}
            >
              <TableCell className="text-muted-foreground text-xs">
                {video.displayOrder}
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
                {video.width && video.height
                  ? `${video.width}×${video.height}`
                  : "—"}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
