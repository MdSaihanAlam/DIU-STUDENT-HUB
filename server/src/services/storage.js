import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Storage interface: every driver implements
 *   save(buffer, { folder, ext }) -> key
 *   stream(key) -> Readable
 *   remove(key) -> void
 *   exists(key) -> boolean
 * Keys are generated server-side (random) so user-supplied filenames never touch the filesystem.
 */
function createLocalDriver(baseDir) {
  const root = path.isAbsolute(baseDir) ? baseDir : path.join(serverRoot, baseDir);
  fs.mkdirSync(root, { recursive: true });

  const resolveKey = (key) => {
    if (!/^[a-z]+\/[a-f0-9]{32}\.[a-z0-9]{1,5}$/.test(key)) throw new Error('Invalid storage key');
    const full = path.join(root, key);
    if (!full.startsWith(root)) throw new Error('Invalid storage key');
    return full;
  };

  return {
    name: 'local',
    async save(buffer, { folder, ext }) {
      const key = `${folder}/${crypto.randomBytes(16).toString('hex')}.${ext}`;
      const full = resolveKey(key);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, buffer, { flag: 'wx' });
      return key;
    },
    stream(key) {
      return fs.createReadStream(resolveKey(key));
    },
    async exists(key) {
      try {
        await fsp.access(resolveKey(key));
        return true;
      } catch {
        return false;
      }
    },
    async remove(key) {
      try {
        await fsp.unlink(resolveKey(key));
      } catch {
        /* already gone */
      }
    },
  };
}

/**
 * MongoDB GridFS driver: files are stored in the same database, split into 255 KB chunks.
 * Ideal for free hosting where the server disk is wiped on every restart (e.g. Render free plan).
 * Mind the database quota (512 MB on MongoDB Atlas M0); move to object storage as you grow.
 */
function createGridFsDriver() {
  let bucket = null;
  const getBucket = () => {
    if (!bucket) {
      if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
      bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    }
    return bucket;
  };
  const checkKey = (key) => {
    if (!/^[a-z]+\/[a-f0-9]{32}\.[a-z0-9]{1,5}$/.test(key)) throw new Error('Invalid storage key');
    return key;
  };
  return {
    name: 'gridfs',
    save(buffer, { folder, ext }) {
      const key = `${folder}/${crypto.randomBytes(16).toString('hex')}.${ext}`;
      return new Promise((resolve, reject) => {
        const upload = getBucket().openUploadStream(key);
        upload.on('error', reject).on('finish', () => resolve(key));
        upload.end(buffer);
      });
    },
    stream(key) {
      return getBucket().openDownloadStreamByName(checkKey(key));
    },
    async exists(key) {
      return (await getBucket().find({ filename: checkKey(key) }).limit(1).toArray()).length > 0;
    },
    async remove(key) {
      const files = await getBucket().find({ filename: checkKey(key) }).toArray();
      await Promise.all(files.map((f) => getBucket().delete(f._id)));
    },
  };
}

/**
 * Object storage (S3, Cloudflare R2, Backblaze B2, ...) is not bundled to keep dependencies
 * small. To add it, implement the same four methods with the provider SDK and register it here.
 */
function createUnconfiguredDriver(name) {
  const fail = () => {
    throw new Error(`Storage driver "${name}" is not implemented. Use STORAGE_DRIVER=local or gridfs, or add a driver in services/storage.js`);
  };
  return { name, save: fail, stream: fail, exists: fail, remove: fail };
}

const DRIVERS = { local: () => createLocalDriver(env.uploadDir), gridfs: createGridFsDriver };
export const storage = (DRIVERS[env.storageDriver] || (() => createUnconfiguredDriver(env.storageDriver)))();

/** URL under which public images (avatars, post images, listing photos) are served. */
export const publicFileUrl = (key) => `/api/v1/files/${key}`;
