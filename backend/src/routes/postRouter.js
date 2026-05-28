import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';

import {
  getAllPosts,
  getPostById,
  writePost,
  deletePost,
  applyMatch,
  cancelApply
} from '../controllers/postController.js';

const router = express.Router();

router.use(authenticateToken);

// 취미 매칭 게시글 CRUD
router.get('/',      getAllPosts);          // GET    /posts
router.get('/:id',   getPostById);          // GET    /posts/:id
router.post('/',     writePost);            // POST   /posts
router.delete('/:id', deletePost);          // DELETE /posts/:id


// 취미 매칭 신청 및 취소
router.post('/:id/apply', applyMatch);      // POST    /posts/:id/apply
router.delete('/:id/apply', cancelApply);   // DELETE  /posts/:id/apply


export default router;