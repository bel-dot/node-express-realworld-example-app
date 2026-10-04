import { executeWithFallback } from '../../app/utils/resilience';

describe('Автоматизована верифікація стійкості (GET /api/articles)', () => {
  // Фіктивний контракт відповіді згідно зі специфікацією Conduit
  const mockArticlesDbResult = {
    articles: [
      {
        title: 'Production Article from PostgreSQL',
        slug: 'production-article-postgresql',
        description: 'Loaded directly from primary DB storage.',
        body: 'Full article body content...',
        tagList: ['postgresql', 'production'],
        author: {
          username: 'author_1',
          bio: 'Author Bio',
          image: '',
          following: false,
        },
        favoritesCount: 15,
        favorited: false,
        createdAt: '2026-09-28T00:00:00.000Z',
        updatedAt: '2026-09-28T00:00:00.000Z',
      },
    ],
    articlesCount: 1,
  };

  const mockFallbackResponse = {
    articles: [
      {
        title: 'System Notice: Operating in Read-Only Fallback Mode',
        slug: 'system-notice-read-only-fallback-mode',
        description: 'Temporary database outage notice for read-only fallback mode.',
        body: 'The database connection is currently unavailable. Displaying cached articles.',
        tagList: ['maintenance', 'system', 'postgresql'],
        author: {
          username: 'system',
          bio: 'Automated Diagnostic Agent',
          image: '',
          following: false,
        },
        favoritesCount: 0,
        favorited: false,
        createdAt: '2026-09-28T00:00:00.000Z',
        updatedAt: '2026-09-28T00:00:00.000Z',
      },
    ],
    articlesCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Приглушуємо логування в консоль під час прогону тестів
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Перевірка 1. Позитивний сценарій: штатна робота
  it('1. Позитивний тест: повертає дані з БД і не активує fallback при успішному запиті', async () => {
    const mockPrimaryDb = jest.fn().mockResolvedValue(mockArticlesDbResult);
    const mockFallback = jest.fn().mockResolvedValue(mockFallbackResponse);

    const result = await executeWithFallback(mockPrimaryDb, mockFallback);

    expect(result).toEqual(mockArticlesDbResult);
    expect(mockPrimaryDb).toHaveBeenCalledTimes(1);
    expect(mockFallback).not.toHaveBeenCalled();
  });

  // Перевірка 2. Відновлення після транзитного збою
  it('2. Транзитний збій: відновлюється на другій спробі без виклику fallback', async () => {
    const transientError = new Error('ConnectionTimeout: PostgreSQL pool connection failed');
    const mockPrimaryDb = jest
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(mockArticlesDbResult);

    const mockFallback = jest.fn().mockResolvedValue(mockFallbackResponse);

    const result = await executeWithFallback(mockPrimaryDb, mockFallback, {
      maxRetries: 2,
      initialDelayMs: 5,
      jitter: false,
    });

    expect(result).toEqual(mockArticlesDbResult);
    expect(mockPrimaryDb).toHaveBeenCalledTimes(2); // 1 вихідна спроба + 1 retry
    expect(mockFallback).not.toHaveBeenCalled();
  });

  // Перевірка 3. Постійна відмова: точна кількість Retry та коректний Fallback
  it('3. Відмова залежності: виконує рівно 2 повтори (3 виклики) та повертає fallback', async () => {
    const persistentDbError = new Error('ConnectionTimeout: PostgreSQL pool connection failed');
    const mockPrimaryDb = jest.fn().mockRejectedValue(persistentDbError);
    const mockFallback = jest.fn().mockResolvedValue(mockFallbackResponse);

    const maxRetries = 2;
    const result = await executeWithFallback<typeof mockFallbackResponse>(mockPrimaryDb, mockFallback, {
      maxRetries,
      initialDelayMs: 5,
      jitter: false,
    });

    // 1 вихідний запит + maxRetries повторів = 3 виклики
    expect(mockPrimaryDb).toHaveBeenCalledTimes(maxRetries + 1);
    expect(mockFallback).toHaveBeenCalledTimes(1);
    expect(mockFallback).toHaveBeenCalledWith(persistentDbError);
    expect(result).toEqual(mockFallbackResponse);
    expect(result.articles[0].slug).toBe('system-notice-read-only-fallback-mode');
  });
});