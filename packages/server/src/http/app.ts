import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import {
  leaderboardQuerySchema,
  loginSchema,
  paginationSchema,
  registerSchema,
  type AuthResponse,
  type Difficulty,
  type HealthResponse,
  type PublicUser,
} from '@maze/shared';
import { signToken, verifyToken } from '../auth/jwt';
import { hashPassword, verifyPassword } from '../auth/password';
import type { Repositories, UserRecord } from '../db/repositories/types';
import type { Logger } from '../logger';
import type { Metrics } from '../metrics';

export interface AppDeps {
  repos: Repositories;
  jwtSecret: string;
  clientOrigins: string[];
  bcryptCost: number;
  metrics: Metrics;
  logger: Logger;
  authRateLimit?: number; // requests per 15 min per IP
}

type AuthedRequest = Request & { userId?: string };

const publicUser = (u: UserRecord): PublicUser => ({ id: u.id, username: u.username, email: u.email });

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const started = Date.now();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: deps.clientOrigins, credentials: false }));
  app.use(express.json({ limit: '16kb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: deps.authRateLimit ?? 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED' },
  });

  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token ? verifyToken(token, deps.jwtSecret) : null;
    if (!payload) return res.status(401).json({ error: 'UNAUTHORIZED' });
    req.userId = payload.sub;
    next();
  };

  const issue = (u: UserRecord): AuthResponse => ({
    token: signToken({ sub: u.id, name: u.username }, deps.jwtSecret),
    user: publicUser(u),
  });

  app.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSec: Math.round((Date.now() - started) / 1000),
      rooms: deps.metrics.rooms,
      players: deps.metrics.players,
      avgTickMs: deps.metrics.avgTickMs,
      db: deps.repos.kind,
    };
    res.json(body);
  });

  app.post('/auth/register', authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: 'INVALID_PAYLOAD', issues: parsed.error.issues });
      const { username, email, password } = parsed.data;
      const created = await deps.repos.users.create({
        username,
        email,
        passwordHash: await hashPassword(password, deps.bcryptCost),
      });
      if (created === 'duplicate') return res.status(409).json({ error: 'USER_EXISTS' });
      res.status(201).json(issue(created));
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/login', authLimiter, async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'INVALID_PAYLOAD' });
      const user = await deps.repos.users.findByLogin(parsed.data.login);
      if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      }
      res.json(issue(user));
    } catch (err) {
      next(err);
    }
  });

  app.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const user = await deps.repos.users.findById(req.userId!);
      if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
      res.json(publicUser(user));
    } catch (err) {
      next(err);
    }
  });

  app.get('/me/matches', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const q = paginationSchema.safeParse(req.query);
      if (!q.success) return res.status(400).json({ error: 'INVALID_PAYLOAD' });
      res.json({ matches: await deps.repos.matches.history(req.userId!, q.data.limit, q.data.offset) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/leaderboard', async (req, res, next) => {
    try {
      const q = leaderboardQuerySchema.safeParse(req.query);
      if (!q.success) return res.status(400).json({ error: 'INVALID_PAYLOAD' });
      const { mode, mapId, difficulty, limit, offset } = q.data;
      if (mode === 'versus') {
        res.json({ mode, entries: await deps.repos.matches.versusLeaderboard(limit, offset) });
        return;
      }
      res.json({
        mode,
        entries: await deps.repos.matches.leaderboard(mapId, difficulty as Difficulty, limit, offset),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/users/:id/profile', async (req, res, next) => {
    try {
      const profile = await deps.repos.matches.profile(String(req.params.id));
      if (!profile) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((err as { type?: string }).type === 'entity.parse.failed')
      return res.status(400).json({ error: 'INVALID_JSON' });
    deps.logger.error({ err }, 'request failed');
    res.status(500).json({ error: 'INTERNAL' });
  });

  return app;
}
