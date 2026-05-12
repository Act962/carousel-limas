"use client";

import { useCallback, useState } from "react";
import type { FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileVideo, UploadCloud, XCircle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UploadStatus = "queued" | "uploading" | "done" | "error";

type FileItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  videoId?: string;
  errorMsg?: string;
};

interface MultiUploaderProps {
  onComplete?: (videoIds: string[]) => void;
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MultiUploader({ onComplete }: MultiUploaderProps) {
  const [items, setItems] = useState<FileItem[]>([]);

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const uploadOne = useCallback(
    async (item: FileItem) => {
      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        // 1. Gerar presigned URL + criar Video(PENDING)
        const presignRes = await fetch("/api/s3/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            contentType: item.file.type,
            size: item.file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err?.error ?? "Falha ao gerar URL de upload.");
        }

        const { presignedUrl, videoId } = await presignRes.json();
        updateItem(item.id, { videoId });

        // 2. Upload direto para R2 via XHR (com progresso)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 204) resolve();
            else reject(new Error(`HTTP ${xhr.status}`));
          };

          xhr.onerror = () => reject(new Error("Falha na conexão com o storage."));

          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", item.file.type);
          xhr.send(item.file);
        });

        // 3. Confirmar upload → Video(READY)
        await fetch("/api/s3/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        updateItem(item.id, { status: "done", progress: 100 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido.";
        updateItem(item.id, { status: "error", errorMsg: msg });

        // Marcar como falho no banco se temos o videoId
        const current = items.find((i) => i.id === item.id);
        const vid = current?.videoId ?? item.videoId;
        if (vid) {
          await fetch("/api/s3/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: vid, failed: true }),
          }).catch(() => null);
        }

        toast.error(`Erro ao enviar "${item.file.name}": ${msg}`);
      }
    },
    [items, updateItem],
  );

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        toast.error("Apenas arquivos de vídeo são aceitos.");
      }

      if (accepted.length === 0) return;

      const newItems: FileItem[] = accepted.map((file) => ({
        id: uuidv4(),
        file,
        status: "queued",
        progress: 0,
      }));

      setItems((prev) => [...prev, ...newItems]);

      // Disparar todos os uploads em paralelo
      Promise.allSettled(newItems.map(uploadOne)).then(() => {
        setItems((prev) => {
          const doneIds = prev
            .filter((i) => i.status === "done" && i.videoId)
            .map((i) => i.videoId!);
          if (doneIds.length > 0) onComplete?.(doneIds);
          return prev;
        });
      });
    },
    [uploadOne, onComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: true,
  });

  const allDone = items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");

  return (
    <div className="flex flex-col gap-3">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/20",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className={cn("h-8 w-8", isDragActive ? "text-primary" : "text-muted-foreground/50")} />
        <div>
          <p className="text-sm font-medium">
            {isDragActive ? "Solte os vídeos aqui" : "Arraste vídeos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vários arquivos ao mesmo tempo · MP4, MOV, WebM
          </p>
        </div>
      </div>

      {/* Lista de arquivos */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1 rounded-md border border-border bg-secondary/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{item.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(item.file.size)}
                </span>
                {item.status === "uploading" && <Spinner className="shrink-0" />}
                {item.status === "done" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                )}
                {item.status === "error" && (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
              </div>

              {item.status === "uploading" && (
                <Progress value={item.progress} className="h-1" />
              )}
              {item.status === "error" && (
                <p className="text-xs text-destructive">{item.errorMsg}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {allDone && (
        <p className="text-center text-xs text-muted-foreground">
          {items.filter((i) => i.status === "done").length} de {items.length} vídeo(s) enviado(s) com sucesso.
        </p>
      )}
    </div>
  );
}
