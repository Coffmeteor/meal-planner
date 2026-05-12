// Adapter: Sync — future serverless sync placeholder
// Currently local-only. Will support:
// - serverless sync (Cloudflare Durable Objects / S3 / etc.)
// - conflict resolution
// - multi-device merge

export async function syncPush(data) {
  // TODO: implement serverless sync
  return { ok: true, local: true }
}

export async function syncPull() {
  // TODO: implement serverless sync
  return null
}

export async function syncMerge(local, remote) {
  // TODO: implement conflict resolution
  return local
}
