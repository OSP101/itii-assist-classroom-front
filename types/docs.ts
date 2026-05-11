export interface DocsArticleSection {
  id: string;
  title: string;
  level: number;
}

export interface DocsArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  audience: string;
  icon: string;
  updatedAt: string;
  readingTime: string;
  content: string;
  sections: DocsArticleSection[];
  related: string[];
}
