import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FormDataParseError, parseFormData } from 'remix/form-data-parser'
import { openLazyFile, writeFile } from 'remix/fs'
import { MultipartParseError } from 'remix/multipart-parser'
import { createRequestListener } from 'remix/node-fetch-server'
import { createHtmlResponse } from 'remix/response/html'
import { createRouter } from 'remix/router'
import { get, post, route } from 'remix/routes'

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const routes = route({ home: get('/'), upload: post('/upload') })
const router = createRouter()

router.map(routes, {
  actions: {
    home() {
      return createHtmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PNG avatar upload</title>
  </head>
  <body>
    <h1>Upload a PNG avatar</h1>
    <p>Choose a PNG image up to 2 MiB. The server checks its PNG signature.</p>
    <form method="post" action="${routes.upload.href()}" enctype="multipart/form-data">
      <label for="avatar">PNG image</label>
      <input id="avatar" name="avatar" type="file" accept="image/png" required>
      <button type="submit">Upload</button>
    </form>
  </body>
</html>`)
    },
    upload: uploadAvatar,
  },
})

async function uploadAvatar({ request }) {
  let directory = await mkdtemp(join(tmpdir(), 'remix-png-upload-'))
  let uploadedFilePath = join(directory, 'avatar.png')
  let hasAvatar = false

  try {
    await parseFormData(
      request,
      {
        maxFiles: 1,
        maxParts: 1,
        maxHeaderSize: 8 * 1024,
        maxFileSize: 2 * 1024 * 1024,
        maxTotalSize: 3 * 1024 * 1024,
      },
      async (fileUpload) => {
        if (fileUpload.fieldName === 'avatar') {
          await writeFile(uploadedFilePath, fileUpload)
          hasAvatar = true
        }
      },
    )

    if (!hasAvatar) {
      return Response.json({ error: 'Choose a file in the avatar field.' }, { status: 400 })
    }

    let file = openLazyFile(uploadedFilePath)
    console.log(`Checking PNG signature of ${file.size}-byte upload`)

    // Let empty files reach the slice read: this is the regression being reproduced.
    let headerChunk = file.slice(0, 8)
    let buffer = await headerChunk.arrayBuffer()
    let bytes = new Uint8Array(buffer)
    let isValidPNG =
      bytes.length === PNG_SIGNATURE.length &&
      PNG_SIGNATURE.every((byte, index) => byte === bytes[index])

    if (!isValidPNG) {
      return Response.json(
        { error: 'Invalid image file. Ensure the file is not empty and is a valid PNG.' },
        { status: 400 },
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof FormDataParseError || error instanceof MultipartParseError) {
      return Response.json(
        { error: 'Invalid form data. Upload one file of at most 2 MiB in the avatar field.' },
        { status: 400 },
      )
    }

    console.error('Upload processing failed:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const server = createServer(createRequestListener((request) => router.fetch(request)))

server.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => {
  let address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Expected an HTTP listening address')
  }

  console.log(`PNG upload server: http://127.0.0.1:${address.port}`)
})
