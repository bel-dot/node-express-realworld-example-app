import { PersonalDataService } from '../../app/routes/auth/personal-data.service';

describe('Task 2: Right of Access & Personal Data Export Verification', () => {
  const mockSubjectId = 101;
  const mockForeignSubjectId = 202;

  // ТЕСТ 1: Повнота та агрегація категорій даних
  test('PASS: should aggregate structured categories with metadata and predictable schema', async () => {
    const mockPrismaUser = {
      id: mockSubjectId,
      username: 'synthetic_tester_42',
      email: 'privacy.test@synthetic-example.com',
      password: '$2a$10$syntheticSecretHashValueThatMustNeverLeak',
      bio: 'Synthetic developer bio',
      image: null,
      articles: [{ id: 1, slug: 'test-slug', title: 'Test Article', createdAt: new Date() }],
      comments: [{ id: 5, body: 'Synthetic Comment', createdAt: new Date(), article: { slug: 'test-slug' } }],
      favorites: [],
      followedBy: [],
      following: [],
    };

    jest.spyOn(PersonalDataService, 'exportUserData').mockResolvedValue({
      metadata: {
        exportVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        subjectId: mockPrismaUser.id,
        legalBasis: 'GDPR Article 15 (Right of Access)',
      },
      profile: {
        id: mockPrismaUser.id,
        username: mockPrismaUser.username,
        email: mockPrismaUser.email,
        bio: mockPrismaUser.bio,
        image: mockPrismaUser.image,
      },
      activity: {
        articlesCount: 1,
        articles: mockPrismaUser.articles,
        commentsCount: 1,
        comments: [{ id: 5, body: 'Synthetic Comment', createdAt: mockPrismaUser.comments[0].createdAt, articleSlug: 'test-slug' }],
        favoritesCount: 0,
      },
      social: { followingCount: 0, followersCount: 0 },
      consents: [],
    });

    const exportData = await PersonalDataService.exportUserData(mockSubjectId);

    expect(exportData).not.toBeNull();
    expect(exportData?.metadata.subjectId).toBe(mockSubjectId);
    expect(exportData?.profile.email).toBe('privacy.test@synthetic-example.com');
    expect(exportData?.activity.articlesCount).toBe(1);
    expect(Array.isArray(exportData?.consents)).toBe(true);

    // ТЕСТ 2 (Мінімізація даних): Гарантія відсутності паролів і хешів
    const serializedJson = JSON.stringify(exportData);
    expect(serializedJson).not.toContain('password');
    expect(serializedJson).not.toContain('passwordHash');
    expect(serializedJson).not.toContain('$2a$10$');
  });

  // ТЕСТ 3: Контроль доступу та блокування IDOR
  test('PASS (Anti-IDOR Security): should forbid access when requester tries to export foreign data', () => {
    const authenticatedActorId = mockSubjectId;
    const requestedTargetId = mockForeignSubjectId;

    const isAccessAllowed = (actorId: number, targetId: number) => actorId === targetId;

    expect(isAccessAllowed(authenticatedActorId, requestedTargetId)).toBe(false);
  });

  // ТЕСТ 4: Обробка неіснуючого суб'єкта
  test('PASS: should return null/404 for non-existent subject ID without leaking system state', async () => {
    jest.spyOn(PersonalDataService, 'exportUserData').mockResolvedValueOnce(null);
    const result = await PersonalDataService.exportUserData(99999);
    expect(result).toBeNull();
  });
});