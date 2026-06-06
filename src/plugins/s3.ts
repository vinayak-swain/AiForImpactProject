import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

declare module 'fastify' {
  interface FastifyInstance {
    storage: {
      uploadFile(key: string, body: Buffer, contentType: string): Promise<string>;
      getPresignedUrl(key: string): Promise<string>;
      deleteFile(key: string): Promise<void>;
    };
  }
}

async function s3Plugin(fastify: FastifyInstance) {
  const isMock = process.env.AWS_ACCESS_KEY_ID === 'mock' || !process.env.AWS_ACCESS_KEY_ID;
  const bucketName = process.env.S3_BUCKET_NAME || 'techprep-ai-reports';

  if (isMock) {
    // Local storage fallback for local development
    const localStorageDir = path.join(process.cwd(), 'local_storage');
    if (!fs.existsSync(localStorageDir)) {
      fs.mkdirSync(localStorageDir, { recursive: true });
    }

    fastify.log.warn('AWS S3 Credentials not configured or set to mock. Falling back to local storage.');

    fastify.decorate('storage', {
      async uploadFile(key: string, body: Buffer, contentType: string) {
        const filePath = path.join(localStorageDir, key.replace(/\//g, '_'));
        await fs.promises.writeFile(filePath, body);
        fastify.log.info(`[Mock S3] Uploaded file to local storage: ${filePath}`);
        return `local://${key}`;
      },
      async getPresignedUrl(key: string) {
        // Return a local api route url that serves the file!
        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        return `${apiUrl}/api/resumes/download-local?key=${encodeURIComponent(key)}`;
      },
      async deleteFile(key: string) {
        const filePath = path.join(localStorageDir, key.replace(/\//g, '_'));
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
    });
  } else {
    // Real S3 setup
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    fastify.decorate('storage', {
      async uploadFile(key: string, body: Buffer, contentType: string) {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        });
        await s3.send(command);
        return `s3://${bucketName}/${key}`;
      },
      async getPresignedUrl(key: string) {
        // Generates pre-signed URL valid for 1 hour (3600 seconds)
        // Note: The getSignedUrl works with S3 commands, we need a GetObject command
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        return getSignedUrl(s3, command, { expiresIn: 3600 });
      },
      async deleteFile(key: string) {
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        await s3.send(command);
      }
    });
  }
}

export default fp(s3Plugin);
