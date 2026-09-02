import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

describe('Media Upload & Static Asset Delivery Suite (VPS + Cloudflare CDN)', () => {
  it('POST /api/v1/upload - uploads an image, optimizes to WebP, and returns public URL', async () => {
    // Generate a test 100x100 PNG in memory using sharp
    const testPngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post('/api/v1/upload')
      .set('x-mock-role', 'Admin')
      .attach('image', testPngBuffer, 'test-product.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.format).toBe('webp');
    expect(res.body.data.filename).toMatch(/^img_\d+_[a-f0-9]+\.webp$/);
    expect(res.body.data.url).toContain('/uploads/' + res.body.data.filename);

    const filename = res.body.data.filename;
    const uploadedFilePath = path.join(process.cwd(), 'uploads', filename);
    expect(fs.existsSync(uploadedFilePath)).toBe(true);

    // Test static serving via GET /uploads/:filename
    const staticRes = await request(app).get(`/uploads/${filename}`);
    expect(staticRes.status).toBe(200);
    expect(staticRes.headers['content-type']).toContain('image/webp');
    expect(staticRes.headers['cache-control']).toContain('max-age=2592000');
    expect(staticRes.headers['access-control-allow-origin']).toBe('*');

    // Test deletion of uploaded file
    const delRes = await request(app)
      .delete(`/api/v1/upload/${filename}`)
      .set('x-mock-role', 'Admin');
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(fs.existsSync(uploadedFilePath)).toBe(false);
  });

  it('POST /api/v1/upload - rejects non-image files', async () => {
    const fakeTextBuffer = Buffer.from('this is a text file pretending to be image');

    const res = await request(app)
      .post('/api/v1/upload')
      .set('x-mock-role', 'Admin')
      .attach('image', fakeTextBuffer, 'notes.txt');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INVALID_FILE');
  });

  it('POST /api/v1/upload - rejects requests without file', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('x-mock-role', 'Admin');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_FILE');
  });
});
