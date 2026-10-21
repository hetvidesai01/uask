// Real backend uploads (frozen contract: POST /uploads, multipart file
// field `file`). Storage-provider details stay entirely behind the API —
// components only ever see { id, name, url, size, mimeType } (and the
// { name } chips they already render).
//
// Files are uploaded UNBOUND (no entityType/entityId): ASK/offer rows don't
// exist yet while their forms are being filled, which is exactly the
// contract's documented unbound "ask-payload flow" — the returned dict then
// travels inside the ASK/offer create payload (`attachments`, max 5 per
// AskCreate/OfferCreate).
import { http } from './http'

const MAX_ATTACHMENTS = 5 // AskCreate/OfferCreate max_length

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  return http.postForm('/uploads', form)
}

// Turns the forms' attachment entries ({ name, file }) into the dicts the
// backend stores, in order:
// - entries that already carry a `url` (a previous upload in this session,
//   or a retry after a failed create) pass through without re-uploading;
// - entries with a live File are uploaded now — first failure aborts with
//   the backend's error (its message lands in the caller's existing toast);
// - entries without a File (drafts saved before the file reference existed)
//   keep their name-only shape — the same data ask/offer create accepted
//   before this integration, never silently upgraded or dropped.
// More than 5 entries throws with a clear message rather than letting the
// create call 422 (the form itself has no cap).
export async function uploadAttachments(entries) {
  if (!entries?.length) return []
  if (entries.length > MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_ATTACHMENTS} files.`)
  }

  const uploaded = []
  for (const entry of entries) {
    if (entry?.url) {
      uploaded.push({
        id: entry.id,
        name: entry.name,
        url: entry.url,
        size: entry.size,
        mimeType: entry.mimeType,
      })
    } else if (entry?.file instanceof File) {
      uploaded.push(await uploadFile(entry.file))
    } else {
      uploaded.push({ name: entry?.name ?? '' })
    }
  }
  return uploaded
}
