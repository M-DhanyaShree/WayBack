import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routesV1 from './routes/v1';
import { errorHandler } from './middlewares/error.middleware';

import path from 'path';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Static file serving for uploads (PoD images fallback)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use('/api/v1', routesV1);

app.use(errorHandler);

export default app;
