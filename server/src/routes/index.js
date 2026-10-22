import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import postRoutes from './posts.js';
import contentRoutes from './content.js';
import communityRoutes from './communities.js';
import messageRoutes from './messages.js';
import adminRoutes from './admin.js';
import publicRoutes from './public.js';
import fileRoutes from './files.js';
import cronRoutes from './cron.js';

const router = Router();

router.use('/cron', cronRoutes);
router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.use('/files', fileRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/communities', communityRoutes);
router.use('/conversations', messageRoutes);
router.use('/admin', adminRoutes);
router.use('/', contentRoutes); // resources, housing, departments, faculty, research, alumni, careers, events, ...

export default router;
