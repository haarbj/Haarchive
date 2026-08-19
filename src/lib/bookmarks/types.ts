export type Bookmark = {
  id: string;
  userId: string;
  topicSlug: string;
  createdAt: string;
};

export type BookmarkRow = {
  id: string;
  user_id: string;
  topic_slug: string;
  created_at: string;
};

export function mapBookmarkRow(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    topicSlug: row.topic_slug,
    createdAt: row.created_at,
  };
}
