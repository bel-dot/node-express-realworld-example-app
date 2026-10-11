import { PrismaClient } from '@prisma/client';
import { PersonalDataExportDto } from './personal-data.dto';

const prisma = new PrismaClient();

export class PersonalDataService {
  public static async exportUserData(userId: number): Promise<PersonalDataExportDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        articles: {
          select: {
            id: true,
            slug: true,
            title: true,
            createdAt: true,
          },
        },
        comments: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            article: {
              select: { slug: true },
            },
          },
        },
        favorites: {
          select: { id: true },
        },
        followedBy: {
          select: { id: true },
        },
        following: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Складання безпечної моделі експорту (password/passwordHash суворо відсікаються)
    return {
      metadata: {
        exportVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        subjectId: user.id,
        legalBasis: 'GDPR Article 15 (Right of Access)',
      },
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        image: user.image,
      },
      activity: {
        articlesCount: user.articles.length,
        articles: user.articles,
        commentsCount: user.comments.length,
        comments: user.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          articleSlug: c.article?.slug,
        })),
        favoritesCount: user.favorites.length,
      },
      social: {
        followingCount: user.following.length,
        followersCount: user.followedBy.length,
      },
      consents: [], // До Завдання 4 повертає передбачувану порожню структуру
    };
  }
}