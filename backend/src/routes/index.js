import express, { Router } from 'express';
import postRouter from './postRouter.js';

const router = Router();

router.use('/posts', postRouter);

export default router;