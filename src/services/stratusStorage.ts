/**
 * Zoho Catalyst Stratus Object Storage Service
 *
 * Handles direct object uploads to Zoho Catalyst Stratus buckets with
 * automatic OAuth2 refresh token rotation and CDN-accelerated public URL generation.
 */

interface ZohoTokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

let tokenCache: ZohoTokenCache | null = null;

/**
 * Checks if Zoho Stratus object storage is enabled and configured in environment.
 */
export function isStratusEnabled(): boolean {
  return (
    process.env.ZOHO_STRATUS_ENABLED === 'true' &&
    Boolean(process.env.ZOHO_REFRESH_TOKEN) &&
    Boolean(process.env.ZOHO_CLIENT_ID) &&
    Boolean(process.env.ZOHO_CLIENT_SECRET) &&
    Boolean(process.env.ZOHO_STRATUS_BUCKET_URL)
  );
}

/**
 * Retrieves a valid Zoho access token, automatically refreshing when expired.
 */
export async function getStratusAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if valid for at least 60 more seconds
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const accountsUrl = (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/+$/, '');
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho Stratus credentials (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN) are not fully configured.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Zoho Stratus OAuth token (HTTP ${response.status}): ${errorText}`);
  }

  const data: any = await response.json();

  if (!data.access_token) {
    throw new Error(`Zoho token endpoint returned no access_token: ${JSON.stringify(data)}`);
  }

  const expiresInSeconds = Number(data.expires_in) || 3600;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  };

  return data.access_token;
}

export interface StratusUploadResult {
  publicUrl: string;
  objectKey: string;
  filename: string;
  size: number;
}

/**
 * Uploads an image Buffer directly to the Zoho Catalyst Stratus bucket.
 *
 * @param buffer - The image buffer (typically compressed WebP)
 * @param filename - The filename (e.g. img_1788544_abc.webp)
 * @param folderPrefix - Optional directory path within bucket (default: 'products')
 * @param contentType - MIME type (default: 'image/webp')
 */
export async function uploadToStratus(
  buffer: Buffer,
  filename: string,
  folderPrefix: string = 'products',
  contentType: string = 'image/webp'
): Promise<StratusUploadResult> {
  const bucketUrl = (process.env.ZOHO_STRATUS_BUCKET_URL || '').replace(/\/+$/, '');
  if (!bucketUrl) {
    throw new Error('ZOHO_STRATUS_BUCKET_URL is not set in environment.');
  }

  const accessToken = await getStratusAccessToken();
  const sanitizedFilename = filename.replace(/[^\w.-]/g, '_');
  const objectKey = folderPrefix ? `${folderPrefix}/${sanitizedFilename}` : sanitizedFilename;

  const uploadEndpoint = `${bucketUrl}/${encodeURI(objectKey)}?orgType=70`;

  const response = await fetch(uploadEndpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Zoho Stratus upload failed for '${objectKey}' (HTTP ${response.status}): ${errorBody}`
    );
  }

  const publicUrl = `${bucketUrl}/${objectKey}`;

  return {
    publicUrl,
    objectKey,
    filename: sanitizedFilename,
    size: buffer.length,
  };
}

/**
 * Deletes an object from the Zoho Catalyst Stratus bucket.
 *
 * @param objectKey - Key of the object to delete (e.g., 'products/img_123.webp')
 */
export async function deleteFromStratus(objectKey: string): Promise<boolean> {
  const bucketUrl = (process.env.ZOHO_STRATUS_BUCKET_URL || '').replace(/\/+$/, '');
  if (!bucketUrl) {
    throw new Error('ZOHO_STRATUS_BUCKET_URL is not set in environment.');
  }

  const accessToken = await getStratusAccessToken();
  const deleteEndpoint = `${bucketUrl}/${encodeURI(objectKey)}?orgType=70`;

  const response = await fetch(deleteEndpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  return response.ok || response.status === 404;
}
