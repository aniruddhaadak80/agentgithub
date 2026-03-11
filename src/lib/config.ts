import os from "node:os";
import path from "node:path";

const defaultStorageRoot = process.env.VERCEL === "1" ? path.join(os.tmpdir(), "autonomous-forge", "repos") : "./runtime/repos";

export const forgeConfig = {
  storageRoot: path.resolve(process.cwd(), process.env.FORGE_STORAGE_ROOT ?? defaultStorageRoot),
  minApprovals: Number(process.env.FORGE_MIN_APPROVALS ?? 2),
};