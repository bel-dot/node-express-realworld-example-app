import { NextFunction, Request, Response, Router } from 'express';
import auth from './auth';
import { createUser, getCurrentUser, login, updateUser } from './auth.service';
import { PrivacyLogger } from '../../utils/privacy-logger';
import { PersonalDataService } from './personal-data.service';
import { AnonymizationService } from './anonymization.service';

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

router.get(
  '/users/:id/personal-data',
  auth.required,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const authenticatedUserId = (req as Request).auth?.user?.id;

      // 1. КОНТРОЛЬ ДОСТУПУ (Захист від IDOR):
      // Заборонено запитувати дані іншого суб'єкта
      if (authenticatedUserId !== targetUserId) {
        PrivacyLogger.warn('Unauthorized personal data access attempt blocked', {
          actorId: authenticatedUserId,
          targetId: targetUserId,
          endpoint: req.originalUrl,
        });

        // 403 Forbidden без тіла PII для чужого суб'єкта
        return res.status(403).json({
          errors: {
            message: 'Forbidden: You are not authorized to access this personal data dossier',
          },
        });
      }

      // 2. АГРЕГАЦІЯ ТА ФОРМУВАННЯ ЕКСПОРТУ
      const exportDossier = await PersonalDataService.exportUserData(targetUserId);

      if (!exportDossier) {
        return res.status(404).json({
          errors: { message: 'Subject profile not found' },
        });
      }

      // 3. БЕЗПЕЧНИЙ АУДИТ-ЛОГ (Без дублювання PII та повного тіла JSON)
      PrivacyLogger.info('Personal data export completed successfully', {
        subjectId: targetUserId,
        categories: ['profile', 'activity', 'social', 'consents'],
      });

      return res.status(200).json(exportDossier);
    } catch (error) {
      PrivacyLogger.error('Failure generating personal data export', error);
      return next(error);
    }
  }
);

router.post(
  '/users/:id/anonymize',
  auth.required,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = Number.parseInt(req.params.id, 10);
      const authenticatedUserId = (req as Request).auth?.user?.id;

      // 1. Захист від IDOR: суб'єкт може ініціювати видалення лише свого профілю
      if (authenticatedUserId !== targetUserId) {
        PrivacyLogger.warn('Unauthorized erasure/anonymization attempt blocked', {
          actorId: authenticatedUserId,
          targetId: targetUserId,
        });
        return res.status(403).json({
          errors: { message: 'Forbidden: You cannot anonymize another subject profile' },
        });
      }

      // 2. Виконання транзакційного знеособлення
      const result = await AnonymizationService.anonymizeUser(targetUserId);

      // 3. Безпечний аудит-лог (без PII)
      PrivacyLogger.info('Subject anonymization workflow completed', {
        subjectId: targetUserId,
        status: result.status,
      });

      return res.status(200).json({
        message: 'Personal data has been irreversibly anonymized in accordance with GDPR Art. 17',
        result,
      });
    } catch (error) {
      PrivacyLogger.error('Failure during anonymization workflow', error);
      return next(error);
    }
  }
);

export default router;
