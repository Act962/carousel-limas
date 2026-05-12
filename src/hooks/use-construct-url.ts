/**
 * Constrói a URL pública completa a partir de uma key armazenada no R2/S3.
 * Nunca retorna `https://undefined/...` quando a env var está vazia.
 */
export function useConstructUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("/") || key.startsWith("data:")) return key;

  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!bucket || bucket === "undefined") {
    if (typeof window !== "undefined") {
      const w = window as unknown as Record<string, unknown>;
      if (!w.__s3WarnShown) {
        w.__s3WarnShown = true;
        console.warn("[useConstructUrl] NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL não configurado.");
      }
    }
    return `/today/${key.replace(/^\/+/, "")}`;
  }

  const host = bucket.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `https://${host}/${cleanKey}`;
}
