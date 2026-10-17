import { Request, Response, NextFunction } from 'express';
import { ConsentService, ConsentPurpose } from './consent.service';
import { PrivacyLogger } from '../../utils/privacy-logger';

export const requireConsent = (purpose: ConsentPurpose) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).auth?.user?.id;

    if (!userId) {
      return res.status(401).json({ errors: { message: 'Authentication required' } });
    }

    const isPermitted = ConsentService.hasActiveConsent(userId, purpose);

    if (!isPermitted) {
      PrivacyLogger.warn('Policy Gate blocked action: missing active consent', {
        userId,
        purpose,
        endpoint: req.originalUrl,
      });

      return res.status(403).json({
        errors: {
          code: 'CONSENT_REQUIRED',
          message: `Action denied: Active consent for '${purpose}' is required under GDPR Article 7`,
          purpose,
        },
      });
    }

    next();
  };
};