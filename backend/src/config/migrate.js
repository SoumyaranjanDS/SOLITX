import pool from "./db.js";

const runMigrations = async () => {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      bio TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPostsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content VARCHAR(500) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createFollowsTableQuery = `
    CREATE TABLE IF NOT EXISTS follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );
  `;

  const createLikesTableQuery = `
    CREATE TABLE IF NOT EXISTS likes (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
  `;

  const createCommentsTableQuery = `
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content VARCHAR(500) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCommentLikesTableQuery = `
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, comment_id)
    );
  `;

  const createIndexesQuery = `
    CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at ON posts (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON comments (post_id, created_at ASC);
  `;

  try {
    console.log("Starting database migrations...");

    await pool.query(createUsersTableQuery);
    console.log("'users' table created/verified successfully!");

    await pool.query(createPostsTableQuery);
    console.log("'posts' table created/verified successfully!");

    await pool.query(createFollowsTableQuery);
    console.log("'follows' table created/verified successfully!");

    await pool.query(createLikesTableQuery);
    console.log("'likes' table created/verified successfully!");

    await pool.query(createCommentsTableQuery);
    console.log("'comments' table created/verified successfully!");

    await pool.query(createCommentLikesTableQuery);
    console.log("'comment_likes' table created/verified successfully!");

    await pool.query(createIndexesQuery);
    console.log("B-Tree Indexes created/verified successfully!");

    await pool.query(
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`,
    );
    console.log("'posts.updated_at' column verified successfully!");

    await pool.query(
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);`,
    );
    console.log("'comments.parent_id' column and index verified successfully!");

    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);`,
    );
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_link VARCHAR(255);`,
    );
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS username_set BOOLEAN DEFAULT FALSE;`,
    );
    console.log(
      "'users.name', 'users.bio_link', and 'users.username_set' columns verified successfully!",
    );

    await pool.query(
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;`,
    );
    console.log("'posts.views_count' column verified successfully!");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, post_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id, created_at DESC);
    `);
    console.log("'bookmarks' table and indexes verified successfully!");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications (recipient_id, created_at DESC);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_content TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key ON notifications (idempotency_key);
    `);
    console.log("'notifications' table, columns, and indexes verified successfully!");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages (sender_id, recipient_id, created_at ASC);
    `);
    console.log("'messages' table and indexes verified successfully!");

    // Posts Category / Topic
    await pool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
      CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category);
    `);
    console.log("'posts.category' column and index verified successfully!");

    // Lists & List Members / Followers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_lists_creator_id ON lists (creator_id);

      CREATE TABLE IF NOT EXISTS list_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (list_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS list_followers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (list_id, user_id)
      );
    `);
    console.log("'lists', 'list_members', 'list_followers' tables verified successfully!");

    // Communities & Community Members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS communities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        banner_gradient VARCHAR(100) DEFAULT 'from-purple-600 to-indigo-800',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities (slug);

      CREATE TABLE IF NOT EXISTS community_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (community_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);
    `);
    console.log("'communities', 'community_members' tables verified successfully!");

    // Posts Community Association
    await pool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts (community_id);
    `);
    console.log("'posts.community_id' column and index verified successfully!");
  } catch (error) {
    console.error("Migration failed:", error.message);
  } finally {
    process.exit(0);
  }
};

runMigrations();
