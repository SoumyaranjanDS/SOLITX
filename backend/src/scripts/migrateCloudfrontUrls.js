import dotenv from "dotenv";
dotenv.config();
import pool from "../config/db.js";

async function migrate() {
  const oldPrefix =
    "https://solitx-media-prod-soumya-842806122222-ap-south-1-an.s3.ap-south-1.amazonaws.com/";
  const newPrefix = "https://dsfu74b9vimiv.cloudfront.net/";

  console.log(`Migrating media URLs from ${oldPrefix} to ${newPrefix}...`);

  const mediaRes = await pool.query(
    `
    UPDATE media
    SET
      url_thumb = REPLACE(url_thumb, $1, $2),
      url_feed = REPLACE(url_feed, $1, $2),
      url_full = REPLACE(url_full, $1, $2)
    WHERE url_thumb LIKE $3 OR url_feed LIKE $3 OR url_full LIKE $3
  `,
    [oldPrefix, newPrefix, `%${oldPrefix}%`],
  );

  console.log(`Updated ${mediaRes.rowCount} media rows.`);

  const userRes = await pool.query(
    `
    UPDATE users
    SET
      avatar_url = REPLACE(avatar_url, $1, $2),
      banner_url = REPLACE(banner_url, $1, $2)
    WHERE avatar_url LIKE $3 OR banner_url LIKE $3
  `,
    [oldPrefix, newPrefix, `%${oldPrefix}%`],
  );

  console.log(`Updated ${userRes.rowCount} user profile rows.`);

  await pool.end();
  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
