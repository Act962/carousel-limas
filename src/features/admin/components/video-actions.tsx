"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConstructUrl } from "@/hooks/use-construct-url";
import type { Video } from "@/lib/videos";

interface VideoActionsProps {
  video: Video;
  onDelete?: (id: string) => void;
}

export function VideoActions({ video, onDelete }: VideoActionsProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const videoUrl = useConstructUrl(video.storageKey);
  const displayName = video.title ?? video.originalName;

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch("/api/s3/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });
      setDeleteOpen(false);
      onDelete?.(video.id);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPreviewOpen(true)}
          title="Pré-visualizar"
        >
          <Eye className="h-4 w-4" />
        </Button>

        {video.status !== "DELETED" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dialog de preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{displayName}</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full rounded-md"
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir vídeo</DialogTitle>
            <DialogDescription>
              O vídeo <span className="font-medium text-foreground">"{displayName}"</span> será
              removido permanentemente do storage. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
