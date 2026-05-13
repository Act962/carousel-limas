import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AddVideoDialog } from "@/features/admin/components/add-video-dialog";
import { StorageBar } from "@/features/admin/components/storage-bar";
import { VideoTable } from "@/features/admin/components/video-table";
import { Button } from "@/components/ui/button";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { listAllVideos } from "@/lib/videos";
import { logoutAction } from "../../features/auth/actions/logout";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? "";

  if (!verifyToken(token)) redirect("/admin/login");

  const videos = await listAllVideos();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <span className="font-semibold tracking-tight">
          Limas Atacado — Admin
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>

      {/* Conteúdo */}
      <main className="flex flex-1 flex-col gap-6 px-8 py-8">
        {/* Storage */}
        <div className="rounded-lg border border-border p-4">
          <StorageBar />
        </div>

        {/* Vídeos */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Vídeos do carrossel</h1>
              <p className="text-sm text-muted-foreground">
                {videos.filter((v) => v.status !== "DELETED").length} vídeo(s)
                cadastrado(s)
              </p>
            </div>
            <AddVideoDialog />
          </div>

          <VideoTable videos={videos} />
        </div>
      </main>
    </div>
  );
}
