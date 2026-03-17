import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

let _client: S3Client | null = null

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT ?? '',
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
      },
    })
  }
  return _client
}

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'craft-agents'

export async function uploadCookies(
  profileId: string,
  cookies: unknown[],
): Promise<string> {
  const key = `cookies/${profileId}.json`
  const body = JSON.stringify(cookies)

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  )

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }
  return `r2://${BUCKET}/${key}`
}

export async function downloadCookies(
  profileId: string,
): Promise<unknown[] | null> {
  const key = `cookies/${profileId}.json`

  try {
    const res = await getClient().send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    )
    const body = await res.Body?.transformToString()
    if (!body) return null
    return JSON.parse(body) as unknown[]
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null
    throw e
  }
}

export async function deleteCookies(profileId: string): Promise<void> {
  const key = `cookies/${profileId}.json`
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}
