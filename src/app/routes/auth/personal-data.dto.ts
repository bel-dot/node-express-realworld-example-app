export interface PersonalDataExportDto {
  metadata: {
    exportVersion: string;
    generatedAt: string;
    subjectId: number;
    legalBasis: string;
  };
  profile: {
    id: number;
    username: string;
    email: string;
    bio: string | null;
    image: string | null;
  };
  activity: {
    articlesCount: number;
    articles: Array<{
      id?: number;
      slug: string;
      title: string;
      createdAt: Date;
    }>;
    commentsCount: number;
    comments: Array<{
      id: number;
      body: string;
      createdAt: Date;
      articleSlug?: string;
    }>;
    favoritesCount: number;
  };
  social: {
    followingCount: number;
    followersCount: number;
  };
  consents: Array<{
    purpose: string;
    isGranted: boolean;
    policyVersion: string;
    grantedAt: Date | null;
  }>;
}