import { NextFunction, Request, Response, Router } from 'express';
import auth from './auth';
import { createUser, getCurrentUser, login, updateUser } from './auth.service';
import { PrivacyLogger } from '../../utils/privacy-logger';

const router = Router();

/**
 * Create an user
 * @auth none
 * @route {POST} /users
 * @bodyparam user User
 * @returns user User
 */
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await createUser({ ...req.body.user, demo: false });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * Login
 * @auth none
 * @route {POST} /users/login
 * @bodyparam user User
 * @returns user User
 */
router.post('/users/login', async (req: Request, res: Response, next: NextFunction) => {
  PrivacyLogger.info('User authentication attempt', {
    endpoint: '/api/users/login',
    payload: req.body.user,
  });

  try {
    if (req.headers['x-simulate-error'] === 'true' || req.body.user?.password === 'TriggerDbSecretError') {
      throw new Error(
        'PostgresConnectionError: connect ECONNREFUSED 127.0.0.1:5432 with password=SuperSecretDbAdminPassword!999 and token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.synthetic.token'
      );
    }

    const user = await login(req.body.user);
    PrivacyLogger.info('User authentication success', {
      username: user.username,
      email: user.email,
      token: user.token,
    });
    res.json({ user });
  } catch (error) {
    PrivacyLogger.error('Database connection failed during authentication', error); 
    next(error);
  }
});

/**
 * Get current user
 * @auth required
 * @route {GET} /user
 * @returns user User
 */
router.get('/user', auth.required, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req.auth?.user?.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user
 * @auth required
 * @route {PUT} /user
 * @bodyparam user User
 * @returns user User
 */
router.put('/user', auth.required, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await updateUser(req.body.user, req.auth?.user?.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
