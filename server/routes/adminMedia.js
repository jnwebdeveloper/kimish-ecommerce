import express from 'express'
import { httpError } from '../lib/http.js'
import { confirmUpload, discardUploads, uploadRequest } from '../services/media.js'

// Admin media uploads. The browser sends files straight to storage (R2/S3) with a signed link,
// so files never pass through the API. Mounted at /api/admin after requireAdmin.
export function adminMediaRoutes({ pool, storage }) {
  const router = express.Router()
  const requireStorage = (_req, _res, next) => {
    if (!storage.enabled)
      throw httpError(
        503,
        'Media uploads are not configured. Set up an R2 or S3 storage (see docs/media-storage-setup.md), or paste a file link instead.',
      )
    next()
  }

  // Body: { contentType, size, folder, recordId? }. Answers with a PUT link valid for 10 minutes.
  router.post('/media/sign', requireStorage, async (req, res) => {
    const { key, contentType, size, mediaType } = uploadRequest(req.body)
    let uploadUrl
    try {
      uploadUrl = await storage.signUpload({ key, contentType, size })
    } catch (err) {
      req.log.error('Could not sign media upload', { storage: storage.active?.name, key, err })
      throw httpError(502, 'The upload could not be started. Please try again.')
    }
    res.status(201).json({
      key,
      uploadUrl,
      url: storage.urlFor(key),
      mediaType,
      headers: { 'Content-Type': contentType },
    })
  })

  // Body: { key }. Checks what actually arrived in storage; answers { url, mediaType }.
  router.post('/media/confirm', requireStorage, async (req, res) => {
    let result
    try {
      result = await confirmUpload(storage, req.body?.key, req.log)
    } catch (err) {
      if (err.status) throw err
      req.log.error('Could not check media upload', { key: req.body?.key, err })
      throw httpError(502, 'The upload could not be checked. Please try again.')
    }
    req.log.info('Media uploaded', { storage: storage.active?.name, key: req.body.key })
    res.json(result)
  })

  // Body: { keys }. Deletes uploads that were never saved; files any record uses are kept.
  router.post('/media/discard', requireStorage, async (req, res) => {
    const deleted = await discardUploads(pool, storage, req.body?.keys, req.log)
    res.json({ deleted })
  })

  return router
}
