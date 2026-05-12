# File Uploader — Especificação de Replicação

Documento autocontido para recriar o componente `file-uploader` em outro projeto Next.js + Tailwind + shadcn/ui.

---

## Visão Geral

O componente `<Uploader />` realiza upload de arquivos (imagens, vídeos ou genéricos) **diretamente para S3/R2** via URL presignada, sem passar os bytes pelo servidor Next.js.

### Fluxo de Upload

```
Browser
  └─ POST /api/s3/upload  →  recebe { presignedUrl, key }
  └─ PUT presignedUrl     →  envia o arquivo direto para o bucket
  └─ callback onConfirm(key)
```

### Fluxo de Deleção

```
Browser
  └─ DELETE /api/s3/delete  { key }  →  remove do bucket
  └─ callback onConfirm("")
```

### Estados Visuais

| Estado | Componente |
|---|---|
| Vazio / aguardando drag | `RenderEmptyState` |
| Enviando (XHR progress) | `RenderUploadingState` |
| Arquivo enviado | `RenderUploadedState` |
| Erro | `RenderErrorState` |

---

## 1. Dependências NPM

```bash
pnpm add react-dropzone uuid @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sonner lucide-react
pnpm add -D @types/uuid
```

Componentes shadcn/ui necessários (se ainda não tiver):

```bash
npx shadcn@latest add card button
```

---

## 2. Variáveis de Ambiente

Adicione no `.env.local`:

```env
# Endpoint do bucket R2 (ou S3)
AWS_ENDPOINT_URL_S3=https://<account-id>.r2.cloudflarestorage.com

# Credenciais do bucket
AWS_ACCESS_KEY_ID=seu_access_key
AWS_SECRET_ACCESS_KEY=seu_secret_key

# Nome do bucket
NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES=nome-do-bucket

# URL pública do bucket (CDN ou domínio público R2)
NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL=https://pub-<hash>.r2.dev
```

> **CORS:** Configure o bucket R2/S3 para aceitar `PUT` e `OPTIONS` vindos do domínio do seu app. Sem isso os uploads do browser vão falhar com "Failed to fetch".

---

## 3. Estrutura de Arquivos

```
src/
├── lib/
│   └── s3-client.ts
├── hooks/
│   └── use-construct-url.ts
├── app/
│   └── api/
│       └── s3/
│           ├── upload/
│           │   └── route.ts
│           └── delete/
│               └── route.ts
└── components/
    ├── ui/
    │   └── spinner.tsx
    └── file-uploader/
        ├── render-state.tsx
        └── uploader.tsx
```

---

## 4. Código Completo dos Arquivos

### `src/lib/s3-client.ts`

```ts
import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

export const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  requestHandler: {
    requestTimeout: 10_000,
    connectionTimeout: 5_000,
  },
  forcePathStyle: false,
});
```

---

### `src/hooks/use-construct-url.ts`

```ts
/**
 * Constrói o URL completo a partir de uma key armazenada (S3/R2).
 * Nunca retorna `https://undefined/...` quando a env var está vazia.
 */
export function useConstructUrl(key: string): string {
  if (!key) return "";

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  if (key.startsWith("/") || key.startsWith("data:")) {
    return key;
  }

  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucket || bucket === "undefined") {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.__s3WarnShown) {
        w.__s3WarnShown = true;
        // eslint-disable-next-line no-console
        console.warn(
          "[useConstructUrl] NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não configurado.",
        );
      }
    }
    return `/uploads/${key.replace(/^\/+/, "")}`;
  }

  const host = bucket.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `https://${host}/${cleanKey}`;
}
```

---

### `src/app/api/s3/upload/route.ts`

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3 } from "@/lib/s3-client";

const fileUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().min(1),
  isImage: z.boolean(),
});

export async function POST(req: Request) {
  const missingVars: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missingVars.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missingVars.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES)
    missingVars.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");

  if (missingVars.length > 0) {
    return NextResponse.json(
      { error: "S3 não configurado. Defina: " + missingVars.join(", ") },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const validation = fileUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid Request Body", details: validation.error.format() },
        { status: 400 },
      );
    }

    const { filename, contentType, size } = validation.data;

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Limite: 20MB." },
        { status: 413 },
      );
    }

    const extension = filename.split(".").pop();
    const uniqueKey = `${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      ContentType: contentType,
      ContentLength: size,
      Key: uniqueKey,
    });

    const presignedUrl = await getSignedUrl(S3, command, {
      expiresIn: 60 * 60, // 1 hora
    });

    return NextResponse.json({ presignedUrl, key: uniqueKey });
  } catch (error) {
    console.error("[s3/upload]", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 },
    );
  }
}
```

---

### `src/app/api/s3/delete/route.ts`

```ts
import { S3 } from "@/lib/s3-client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const key = body.key;

    if (!key) {
      return NextResponse.json(
        { error: "Missing or invalid object key" },
        { status: 400 },
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: key,
    });

    await S3.send(command);

    return NextResponse.json({ message: "File deleted successfully" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 400 },
    );
  }
}
```

---

### `src/components/ui/spinner.tsx`

```tsx
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
```

---

### `src/components/file-uploader/render-state.tsx`

```tsx
import { cn } from "@/lib/utils";
import { FileIcon, ImageIcon, Trash2, UploadIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

export function RenderEmptyState({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
        <UploadIcon
          className={cn("text-muted-foreground", isDragActive && "text-primary")}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Arraste e solte arquivos ou{" "}
        <span className="text-primary font-bold cursor-pointer">
          clique para upload
        </span>
      </p>
    </div>
  );
}

export function RenderErrorState() {
  return (
    <div className="text-destructive text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-destructive/30 mb-4">
        <ImageIcon className="text-destructive" />
      </div>
      <p className="text-sm font-semibold">Falha no upload</p>
      <p className="text-xs mt-1 text-muted-foreground">Algo deu errado</p>
    </div>
  );
}

export function RenderUploadedState({
  previewUrl,
  isDeleting,
  handleDelete,
  fileType,
}: {
  previewUrl: string;
  isDeleting: boolean;
  handleDelete: () => void;
  fileType: "image" | "video" | "outros";
}) {
  return (
    <div className="group">
      {fileType === "image" && (
        <Image
          src={previewUrl}
          alt="Uploaded file"
          fill
          className="object-contain p-2"
        />
      )}

      {fileType === "outros" && (
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <FileIcon className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Arquivo enviado</p>
          <Link
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline"
          >
            Abrir arquivo
          </Link>
        </div>
      )}

      <Button
        variant="destructive"
        size="icon"
        className={cn("absolute top-2 right-2 opacity-0 group-hover:opacity-100")}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? <Spinner /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function RenderUploadingState({
  progress,
}: {
  progress: number;
  file: File;
}) {
  return (
    <div className="text-center flex justify-center items-center flex-col">
      <p>{progress}%</p>
      <p className="mt-2 text-sm font-medium text-foreground">
        <Spinner />
      </p>
    </div>
  );
}
```

---

### `src/components/file-uploader/uploader.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Card, CardContent } from "../ui/card";
import {
  RenderEmptyState,
  RenderErrorState,
  RenderUploadedState,
  RenderUploadingState,
} from "./render-state";

interface UploaderState {
  id: string | null;
  file: File | null;
  uploading: boolean;
  progress: number;
  key?: string;
  isDeleting: boolean;
  error: boolean;
  objectUrl?: string;
  fileType: "image" | "video" | "outros";
}

const MAX_SIZE = 1024 * 1024 * 5; // 5MB

interface UploaderProps {
  /** Key ou URL do arquivo já salvo (preenche o preview inicial) */
  value?: string;
  /** Chamado após upload bem-sucedido E após deleção (recebe "" ao deletar) */
  onConfirm?: (value: string, name?: string) => void;
  /** Tipo de arquivo aceito pelo dropzone */
  fileTypeAccepted?: "image" | "video" | "outros";
  /** Chamado apenas após upload bem-sucedido */
  onUpload?: (value: string, name?: string) => void;
  /** Chamado quando o upload começa */
  onUploadStart?: () => void;
}

export function Uploader({
  value,
  onConfirm,
  fileTypeAccepted = "image",
  onUpload,
  onUploadStart,
}: UploaderProps) {
  const fileUrl = useConstructUrl(value || "");

  const [fileState, setFileState] = useState<UploaderState>({
    error: false,
    file: null,
    id: null,
    uploading: false,
    progress: 0,
    isDeleting: false,
    fileType: fileTypeAccepted,
    key: value,
    objectUrl: value ? fileUrl : undefined,
  });

  const uploadFile = useCallback(
    async (file: File) => {
      setFileState((prev) => ({ ...prev, uploading: true, progress: 0 }));
      onUploadStart?.();

      try {
        const presignedResponse = await fetch("/api/s3/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            isImage: fileTypeAccepted === "image",
          }),
        });

        if (!presignedResponse.ok) {
          const errData = await presignedResponse.json().catch(() => ({}));
          const errMsg =
            presignedResponse.status === 503
              ? "Armazenamento S3 não configurado. Preencha as variáveis de ambiente."
              : (errData?.error ?? "Falha ao gerar URL presignada");
          toast.error(errMsg);
          setFileState((prev) => ({ ...prev, uploading: false, progress: 0, error: true }));
          return;
        }

        const { presignedUrl, key } = await presignedResponse.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const pct = (event.loaded / event.total) * 100;
              setFileState((prev) => ({ ...prev, progress: Math.round(pct) }));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 204) {
              setFileState((prev) => ({ ...prev, progress: 100, uploading: false, key }));
              onConfirm?.(key, file.name);
              onUpload?.(key, file.name);
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));

          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
      } catch {
        toast.error("Falha ao enviar arquivo");
        setFileState((prev) => ({ ...prev, progress: 0, error: true, uploading: false }));
      }
    },
    [fileTypeAccepted, onConfirm, onUpload, onUploadStart],
  );

  async function removeFile() {
    if (fileState.isDeleting || !fileState.objectUrl) return;

    try {
      setFileState((prev) => ({ ...prev, isDeleting: true }));

      const response = await fetch("/api/s3/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fileState.key }),
      });

      if (!response.ok) {
        toast.error("Falha ao deletar arquivo");
        setFileState((prev) => ({ ...prev, isDeleting: false, error: true }));
        return;
      }

      if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
        URL.revokeObjectURL(fileState.objectUrl);
      }

      onConfirm?.("");

      setFileState({
        file: null,
        uploading: false,
        progress: 0,
        objectUrl: undefined,
        error: false,
        fileType: fileTypeAccepted,
        id: null,
        isDeleting: false,
      });

      toast.success("Arquivo deletado com sucesso");
    } catch {
      toast.error("Falha ao deletar arquivo. Por favor, tente novamente.");
      setFileState((prev) => ({ ...prev, isDeleting: false, error: true }));
    }
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
          URL.revokeObjectURL(fileState.objectUrl);
        }

        setFileState({
          file,
          uploading: false,
          progress: 0,
          objectUrl: URL.createObjectURL(file),
          error: false,
          id: uuidv4(),
          isDeleting: false,
          fileType: fileTypeAccepted,
        });

        uploadFile(file);
      }
    },
    [fileState.objectUrl, uploadFile, fileTypeAccepted],
  );

  function rejectedFiles(fileRejection: FileRejection[]) {
    if (!fileRejection.length) return;

    const tooMany = fileRejection.find(
      (r) => r.errors[0].code === "too-many-files",
    );
    const tooBig = fileRejection.find(
      (r) => r.errors[0].code === "file-too-large",
    );

    if (tooBig) toast.error("Arquivo muito grande, máximo de 5MB.");
    if (tooMany) toast.error("Muitos arquivos selecionados, máximo de 1 arquivo.");
  }

  function renderContent() {
    if (fileState.uploading) {
      return (
        <RenderUploadingState
          progress={fileState.progress}
          file={fileState.file as File}
        />
      );
    }
    if (fileState.error) return <RenderErrorState />;
    if (fileState.objectUrl) {
      return (
        <RenderUploadedState
          previewUrl={fileState.objectUrl}
          isDeleting={fileState.isDeleting}
          handleDelete={removeFile}
          fileType={fileState.fileType}
        />
      );
    }
    return <RenderEmptyState isDragActive={isDragActive} />;
  }

  useEffect(() => {
    return () => {
      if (fileState.objectUrl && !fileState.objectUrl.startsWith("http")) {
        URL.revokeObjectURL(fileState.objectUrl);
      }
    };
  }, [fileState.objectUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:
      fileTypeAccepted === "image"
        ? { "image/*": [] }
        : fileTypeAccepted === "outros"
          ? { "*/*": [] }
          : { "video/*": [] },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_SIZE,
    onDropRejected: rejectedFiles,
    disabled: fileState.uploading || !!fileState.objectUrl,
  });

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-40",
        isDragActive
          ? "border-primary bg-primary/10 border-solid"
          : "border-border hover:border-primary",
      )}
    >
      <CardContent className="flex items-center justify-center h-full w-full p-4">
        <input {...getInputProps()} />
        {renderContent()}
      </CardContent>
    </Card>
  );
}
```

---

## 5. Como Usar

```tsx
import { Uploader } from "@/components/file-uploader/uploader";

// Exemplo básico — upload de imagem
<Uploader
  onConfirm={(key) => form.setValue("avatarKey", key)}
/>

// Exemplo completo
<Uploader
  value={savedKey}                           // preenche preview com arquivo já salvo
  fileTypeAccepted="image"                   // "image" | "video" | "outros"
  onConfirm={(key, name) => {
    // chamado após upload bem-sucedido (key = UUID.ext)
    // chamado após deleção (key = "")
    form.setValue("fileKey", key);
  }}
  onUpload={(key, name) => {
    console.log("Upload concluído:", key, name);
  }}
  onUploadStart={() => {
    console.log("Upload iniciado");
  }}
/>
```

### Props

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `value` | `string` | — | Key ou URL do arquivo já salvo. Preenche o preview inicial. |
| `fileTypeAccepted` | `"image" \| "video" \| "outros"` | `"image"` | Filtra os tipos aceitos no dropzone. |
| `onConfirm` | `(key: string, name?: string) => void` | — | Chamado após upload (key = UUID.ext) e após deleção (key = ""). |
| `onUpload` | `(key: string, name?: string) => void` | — | Chamado apenas após upload bem-sucedido. |
| `onUploadStart` | `() => void` | — | Chamado quando o upload começa. |

---

## 6. Checklist de Verificação

- [ ] Variáveis de ambiente preenchidas no `.env.local`
- [ ] CORS configurado no bucket R2/S3 (permite `PUT` e `OPTIONS` do domínio do app)
- [ ] `pnpm add react-dropzone uuid @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sonner` executado
- [ ] Componentes shadcn/ui `Card` e `Button` instalados
- [ ] Upload de imagem funciona e mostra preview inline
- [ ] Upload de arquivo genérico (`outros`) mostra link "Abrir arquivo"
- [ ] Botão de deleção aparece no hover e remove o arquivo
- [ ] Toast de erro aparece quando arquivo > 5MB
- [ ] Toast de erro aparece quando as env vars estão ausentes (status 503)
- [ ] Recarregar a página com `value` preenchido restaura o preview corretamente

---

## 7. Observações de Implementação

- **Memory leak**: o componente revoga `objectUrl` no unmount via `useEffect` — mantenha isso.
- **Limite frontend vs backend**: o dropzone rejeita arquivos > 5MB no cliente; a route `/api/s3/upload` rejeita > 20MB no servidor. Ajuste conforme necessário.
- **Vídeos**: o estado `"video"` está previsto na interface mas sem preview implementado no `render-state.tsx` — para habilitar, adicione o bloco `<video>` no `RenderUploadedState`.
- **S3 vs R2**: o cliente usa `forcePathStyle: false` e `region: "auto"`, compatível com Cloudflare R2. Para AWS S3 nativo, remova `endpoint` e use a `region` correta.
