"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MultiUploader } from "@/components/file-uploader/multi-uploader";
import { Plus } from "lucide-react";

export function AddVideoDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleComplete(videoIds: string[]) {
    if (videoIds.length > 0) {
      router.refresh();
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar vídeo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar vídeos</DialogTitle>
          <DialogDescription>
            Envie um ou mais vídeos para o carrossel do totem.
          </DialogDescription>
        </DialogHeader>

        <MultiUploader onComplete={handleComplete} />
      </DialogContent>
    </Dialog>
  );
}
