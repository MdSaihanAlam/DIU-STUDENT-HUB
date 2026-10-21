import mongoose from 'mongoose';

let memoryServer = null;

/**
 * Connect to MongoDB. With `{ memory: true }` an in-memory MongoDB is started
 * (development/tests only) so the app runs without a local MongoDB install.
 */
export async function connectDB(uri, { memory = false } = {}) {
  let target = uri;
  if (memory) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    target = memoryServer.getUri('diu_student_hub');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(target, { autoIndex: true });
  return target;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
