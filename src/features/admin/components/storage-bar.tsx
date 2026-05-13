import { Progress } from "@/components/ui/progress";
import { formatBytes, getStorageQuota } from "@/lib/videos";

export async function StorageBar() {
  const quota = await getStorageQuota();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Storage utilizado</span>
        <span>
          {formatBytes(quota.usedBytes)} / {formatBytes(quota.limitBytes)}
          <span className="ml-1 text-foreground/50">({quota.usedPercent.toFixed(1)}%)</span>
        </span>
      </div>
      <Progress value={quota.usedPercent} className="h-1.5" />
    </div>
  );
}
