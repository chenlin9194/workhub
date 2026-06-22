import { revalidatePath } from "next/cache";

export function revalidateWorkHubPaths(options?: { itemId?: string; logId?: string }) {
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/items");
  revalidatePath("/logs");
  revalidatePath("/stats");
  revalidatePath("/export/today");
  revalidatePath("/export/range");

  if (options?.itemId) {
    revalidatePath(`/items/${options.itemId}`);
  }

  if (options?.logId) {
    revalidatePath(`/logs/${options.logId}`);
  }
}
