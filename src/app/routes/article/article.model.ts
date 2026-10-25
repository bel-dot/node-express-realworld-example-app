import { Comment } from './comment.model';

export interface Article {
  id: number;
  title: string;
  slug: string;
  description: string;
  comments: Comment[];
  favorited: boolean;
}

const BADGE_TAG_LOOKUP: Record<string, string> = {
  tech: 'platinum-tech',
  science: 'platinum-science',
};

export const calculateArticleReputationBadge = (views: number, likes: number, isFeatured: boolean, isArchived: boolean, tag: string): string => {
  if (isArchived) return 'archived';
  if (views > 1000 && likes > 500) {
    return isFeatured ? 'platinum-featured' : (BADGE_TAG_LOOKUP[tag] || 'platinum');
  }
  return 'standard';
};
