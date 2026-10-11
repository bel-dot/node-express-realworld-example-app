import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export interface AnonymizationResult {
  userId: number;
  status: 'ANONYMIZED';
  anonymizedAt: string;
  affectedEntities: {
    userProfile: string;
    articlesRetained: number;
    commentsRetained: number;
    favoritesRemoved: number;
    followsRemoved: number;
  };
}

export class AnonymizationService {
  public static async anonymizeUser(userId: number): Promise<AnonymizationResult> {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          articles: true,
          comments: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Ідемпотентність: якщо користувача вже знеособлено
      if (user.username.startsWith('deleted_user_')) {
        return {
          userId: user.id,
          status: 'ANONYMIZED',
          anonymizedAt: new Date().toISOString(),
          affectedEntities: {
            userProfile: 'ALREADY_ANONYMIZED',
            articlesRetained: user.articles.length,
            commentsRetained: user.comments.length,
            favoritesRemoved: 0,
            followsRemoved: 0,
          },
        };
      }

      // 1. DELETE зв'язків соціального графу та вподобань
      // Видаляємо зв'язки з таблиці favorites (статті, які користувач лайкнув)
      const favoritesDeleted = await tx.user.update({
        where: { id: userId },
        data: {
          favorites: { set: [] },
          following: { set: [] },
          followedBy: { set: [] },
        },
      });

      // 2. Генерація незворотних анонімних ідентифікаторів
      const deterministicHash = crypto
        .createHash('sha256')
        .update(`${userId}_${Date.now()}_SALT_GDPR`)
        .digest('hex')
        .substring(0, 12);

      const anonymizedUsername = `deleted_user_${userId}`;
      const anonymizedEmail = `anon_${deterministicHash}@deleted.local`;
      const invalidPasswordHash = `$2a$10$DELETED_${crypto.randomBytes(16).toString('hex')}`;

      // 3. ANONYMIZE профілю користувача
      await tx.user.update({
        where: { id: userId },
        data: {
          username: anonymizedUsername,
          email: anonymizedEmail,
          password: invalidPasswordHash,
          bio: null,
          image: null,
        },
      });

      return {
        userId: user.id,
        status: 'ANONYMIZED',
        anonymizedAt: new Date().toISOString(),
        affectedEntities: {
          userProfile: 'ANONYMIZED',
          articlesRetained: user.articles.length,
          commentsRetained: user.comments.length,
          favoritesRemoved: 1,
          followsRemoved: 1,
        },
      };
    });
  }
}