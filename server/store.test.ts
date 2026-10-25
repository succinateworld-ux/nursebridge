import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonStore } from "./store.js";

describe("durable local NurseBridge store", () => {
  it("serializes concurrent writes and restores records after reopening", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nursebridge-store-"));
    try {
      const path = join(directory, "state.json");
      const store = await createJsonStore(path);
      await Promise.all(Array.from({ length: 20 }, (_, index) => store.transact(state => {
        state.sponsorshipRequests.push({ id: String(index), requesterKeyHash: `hash-${index}`, status: "pending", createdAt: "now", updatedAt: "now" });
      })));
      expect(store.read().sponsorshipRequests).toHaveLength(20);
      const restored = await createJsonStore(path);
      expect(restored.read().sponsorshipRequests).toHaveLength(20);
      const json = JSON.parse(await readFile(path, "utf8")) as { version: number };
      expect(json.version).toBe(1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("rejects an existing corrupt database instead of silently replacing it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nursebridge-store-"));
    try {
      const path = join(directory, "state.json");
      await import("node:fs/promises").then(fs => fs.writeFile(path, "{}"));
      await expect(createJsonStore(path)).rejects.toThrow(/invalid schema/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
