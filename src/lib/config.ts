import path from "node:path";

export const forgeConfig = {
  storageRoot: path.resolve(process.cwd(), process.env.FORGE_STORAGE_ROOT ?? "./runtime/repos"),
  minApprovals: Number(process.env.FORGE_MIN_APPROVALS ?? 2),
};