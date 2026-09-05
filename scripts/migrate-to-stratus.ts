import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { uploadToStratus, isStratusEnabled } from '../src/services/stratusStorage.js';

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_PATH || './uploads');

async function migrateImages() {
  if (!isStratusEnabled()) {
    console.error('❌ Zoho Stratus is not enabled or credentials are missing in .env');
    process.exit(1);
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`Directory ${UPLOADS_DIR} does not exist.`);
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
    return f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg');
  });

  if (files.length === 0) {
    console.log('No local images found in ./uploads directory.');
    return;
  }

  console.log(`🚀 Found ${files.length} local images to migrate to Zoho Stratus...`);

  for (const filename of files) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = fs.readFileSync(filePath);

    try {
      console.log(`📤 Uploading ${filename} (${buffer.length} bytes)...`);
      const result = await uploadToStratus(buffer, filename, 'products', 'image/webp');
      console.log(`✅ Uploaded: ${result.publicUrl}`);
    } catch (err: any) {
      console.error(`❌ Failed to migrate ${filename}:`, err.message);
    }
  }

  console.log('✨ All images migrated to Zoho Catalyst Stratus successfully!');
}

migrateImages().catch(console.error);
