//const express = require('express');
//const Router = require('express');
import express, { Router } from 'express';

//const authRouter = require('./authRouter.js');
import authRouter from './authRouter.js';

const router = Router();

router.use('/api/auth', authRouter);

export default router;