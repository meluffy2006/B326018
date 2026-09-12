const env = require("dotenv")
const express = require("express");
const cors    = require("cors");
// const crypto  = require("crypto");   // built-in Node.js — no install needed
const jwt     = require("jsonwebtoken");
const path    = require("path");

const { pool, initDb } = require("./db");
const { auth, JWT_SECRET } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve all HTML/CSS/JS files from the same folder as index.js
app.use(express.static(path.join(__dirname)));

// ── Password helpers using built-in crypto (unchanged) ──────
// function hashPassword(password) {
//     var salt = crypto.randomBytes(16).toString("hex");
//     var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
//     return hash + ":" + salt;
// }
// function verifyPassword(password, stored) {
//     var parts = stored.split(":");
//     var hash  = parts[0];
//     var salt  = parts[1];
//     var check = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
//     return check === hash;
// }

// ── Row → JSON mappers (keep field names identical to the old
//    Mongo shape so forum-app.html / index.html need NO changes) ──
function mapPost(row) {
    var netVotes = row.upvotes - row.downvotes;
    return {
        _id: String(row.id),
        userId: String(row.user_id),
        username: row.username,
        title: row.title,
        content: row.content,
        topic: row.topic,
        mediaUrls: row.media_urls || [],
        mediaTypes: row.media_types || [],
        upvotes: row.upvotes,
        downvotes: row.downvotes,
        spamReports: row.spam_reports,
        createdAt: row.created_at,
        isTrending: row.upvotes > 45,
        netVotes: netVotes
    };
}

function mapComment(row) {
    var netVotes = row.upvotes - row.downvotes;
    return {
        _id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        username: row.username,
        content: row.content,
        upvotes: row.upvotes,
        downvotes: row.downvotes,
        spamReports: row.spam_reports,
        createdAt: row.created_at,
        netVotes: netVotes,
        isTrending: netVotes >= 3
    };
}

function isValidId(id) {
    return /^\d+$/.test(String(id));
}

// ── Generic vote handler (used for both posts & comments) ───
// Replicates the old Mongo logic: first vote free, same-vote-again
// removes it, opposite vote is allowed exactly ONCE.
async function castVote(entityTable, votesTable, idColumn, entityId, userId, voteType) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            `SELECT vote_type, changed FROM ${votesTable} WHERE ${idColumn} = $1 AND user_id = $2`,
            [entityId, userId]
        );

        var message, canChangeVote;

        if (existing.rows.length === 0) {
            // CASE 1: first vote
            await client.query(
                `INSERT INTO ${votesTable} (${idColumn}, user_id, vote_type, changed) VALUES ($1, $2, $3, false)`,
                [entityId, userId, voteType]
            );
            var col = voteType === "up" ? "upvotes" : "downvotes";
            await client.query(`UPDATE ${entityTable} SET ${col} = ${col} + 1 WHERE id = $1`, [entityId]);
            message = "Vote recorded successfully";
            canChangeVote = true;

        } else if (existing.rows[0].vote_type === voteType) {
            // CASE 2A: same vote again → remove it
            await client.query(
                `DELETE FROM ${votesTable} WHERE ${idColumn} = $1 AND user_id = $2`,
                [entityId, userId]
            );
            var col2 = voteType === "up" ? "upvotes" : "downvotes";
            await client.query(`UPDATE ${entityTable} SET ${col2} = ${col2} - 1 WHERE id = $1`, [entityId]);
            message = "Vote removed successfully";

        } else {
            // CASE 2B: opposite vote → allowed exactly once
            if (existing.rows[0].changed) {
                await client.query("ROLLBACK");
                return { conflict: true };
            }
            var oldCol = existing.rows[0].vote_type === "up" ? "upvotes" : "downvotes";
            var newCol = voteType === "up" ? "upvotes" : "downvotes";
            await client.query(
                `UPDATE ${votesTable} SET vote_type = $3, changed = true WHERE ${idColumn} = $1 AND user_id = $2`,
                [entityId, userId, voteType]
            );
            await client.query(
                `UPDATE ${entityTable} SET ${oldCol} = ${oldCol} - 1, ${newCol} = ${newCol} + 1 WHERE id = $1`,
                [entityId]
            );
            message = "Vote changed successfully! (This was your one allowed change)";
            canChangeVote = false;
        }

        const updated = await client.query(`SELECT * FROM ${entityTable} WHERE id = $1`, [entityId]);
        await client.query("COMMIT");
        return { message: message, canChangeVote: canChangeVote, row: updated.rows[0] };

    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

// ── Generic spam-report handler (used for both posts & comments) ──
async function castSpamReport(entityTable, reportsTable, idColumn, entityId, userId) {
    const existing = await pool.query(
        `SELECT 1 FROM ${reportsTable} WHERE ${idColumn} = $1 AND user_id = $2`,
        [entityId, userId]
    );
    if (existing.rows.length > 0) return { conflict: true };

    await pool.query(
        `INSERT INTO ${reportsTable} (${idColumn}, user_id) VALUES ($1, $2)`,
        [entityId, userId]
    );
    await pool.query(`UPDATE ${entityTable} SET spam_reports = spam_reports + 1 WHERE id = $1`, [entityId]);

    const updated = await pool.query(`SELECT * FROM ${entityTable} WHERE id = $1`, [entityId]);
    return { row: updated.rows[0] };
}

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

app.post("/signup", async function(req, res) {
    try {
        var username = (req.body.username || "").trim();
        var password =  req.body.password || "";

        if (!username || !password)
            return res.status(400).json({ message: "Username and password are required." });
        if (username.length < 3 || username.length > 20)
            return res.status(400).json({ message: "Username must be 3-20 characters." });
        if (password.length < 6)
            return res.status(400).json({ message: "Password must be at least 6 characters." });

        var existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
        if (existing.rows.length > 0)
            return res.status(409).json({ message: "That username is already taken. Try another." });

        await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2)",
            [username, password]
        );
        res.json({ message: "Account created! You can now sign in." });

    } catch(err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});
app.post("/signin", async function(req, res) {

    try {

        // Get username and password from frontend
        var username = (req.body.username || "").trim();
        var password = req.body.password || "";

        // Check whether username and password were provided
        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required."
            });
        }

        // Find the user in PostgreSQL
        var result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        // Get first matching user
        var user = result.rows[0];

        // User doesn't exist or password is wrong
        if (!user || !(password, user.password)) {
            return res.status(403).json({
                message: "Invalid username or password."
            });
        }

        // Create JWT token
        var token = jwt.sign(
            {
                id: String(user.id),
                username: user.username
            },
            JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        // Send successful response
        res.json({
            token: token,
            username: user.username
        });

    } catch (err) {

        console.error("Signin error:", err);

        res.status(500).json({
            message: "Server error. Please try again."
        });
    }

});

// ══════════════════════════════════════════════════════════════
//  POST ROUTES
// ══════════════════════════════════════════════════════════════

app.get("/posts", auth, async function(req, res) {
    try {
        var result = await pool.query(
            "SELECT * FROM posts ORDER BY upvotes DESC, downvotes ASC, created_at DESC"
        );
        res.json({ posts: result.rows.map(mapPost) });
    } catch(err) {
        console.error("Get posts error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.get("/posts/mine", auth, async function(req, res) {
    try {
        var result = await pool.query(
            "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC",
            [req.userId]
        );
        res.json({ posts: result.rows.map(mapPost) });
    } catch(err) {
        console.error("Get my posts error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts", auth, async function(req, res) {
    try {
        var title      = (req.body.title   || "").trim();
        var content    = (req.body.content || "").trim();
        var topic      =  req.body.topic   || "General";
        var mediaUrls  = req.body.mediaUrls  || [];  // base64 strings or file URLs
        var mediaTypes = req.body.mediaTypes || [];  // "image" or "video"

        if (!title || !content)
            return res.status(400).json({ message: "Title and content are required." });

        if (mediaUrls.length !== mediaTypes.length)
            return res.status(400).json({ message: "Media URLs and types must match." });

        var MAX_SIZE = 5 * 1024 * 1024; // 5MB per file
        for (var i = 0; i < mediaUrls.length; i++) {
            if (!["image", "video"].includes(mediaTypes[i]))
                return res.status(400).json({ message: "Media type must be 'image' or 'video'." });

            if (mediaUrls[i].startsWith("data:")) {
                var sizeEstimate = mediaUrls[i].length * 0.75;
                if (sizeEstimate > MAX_SIZE)
                    return res.status(400).json({ message: "Media file too large. Max 5MB per file." });
            }
        }

        var result = await pool.query(
            `INSERT INTO posts (user_id, username, title, content, topic, media_urls, media_types)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.userId, req.username, title, content, topic, mediaUrls, mediaTypes]
        );
        res.json({ message: "Post created", post: mapPost(result.rows[0]) });

    } catch(err) {
        console.error("Create post error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.delete("/posts/:id", auth, async function(req, res) {
    try {
        var postId = req.params.id;
        if (!isValidId(postId))
            return res.status(400).json({ message: "Invalid post ID." });

        var result = await pool.query("SELECT * FROM posts WHERE id = $1", [postId]);
        var post = result.rows[0];
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (String(post.user_id) !== req.userId)
            return res.status(403).json({ message: "You can only delete your own posts." });

        await pool.query("DELETE FROM comments WHERE post_id = $1", [postId]);
        await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
        res.json({ message: "Post deleted." });

    } catch(err) {
        console.error("Delete post error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/vote", auth, async function(req, res) {
    try {
        var postId   = req.params.id;
        var voteType = req.body.type; // "up" or "down"

        if (!["up", "down"].includes(voteType))
            return res.status(400).json({ message: "Vote type must be 'up' or 'down'." });
        if (!isValidId(postId))
            return res.status(400).json({ message: "Invalid post ID." });

        var existing = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
        if (existing.rows.length === 0)
            return res.status(404).json({ message: "Post not found." });

        var result = await castVote("posts", "post_votes", "post_id", postId, req.userId, voteType);
        if (result.conflict)
            return res.status(409).json({ message: "You can only change your vote ONCE! You have already changed it." });

        res.json({ message: result.message, post: mapPost(result.row), canChangeVote: result.canChangeVote });

    } catch(err) {
        console.error("Post vote error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/spam", auth, async function(req, res) {
    try {
        var postId = req.params.id;
        if (!isValidId(postId))
            return res.status(400).json({ message: "Invalid post ID." });

        var existing = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
        if (existing.rows.length === 0)
            return res.status(404).json({ message: "Post not found." });

        var result = await castSpamReport("posts", "post_spam_reports", "post_id", postId, req.userId);
        if (result.conflict)
            return res.status(409).json({ message: "You have already reported this post." });

        res.json({ message: "Spam reported", post: mapPost(result.row) });

    } catch(err) {
        console.error("Post spam report error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

// ══════════════════════════════════════════════════════════════
//  COMMENT ROUTES
// ══════════════════════════════════════════════════════════════

app.get("/posts/:id/comments", auth, async function(req, res) {
    try {
        var postId = req.params.id;
        if (!isValidId(postId))
            return res.status(400).json({ message: "Invalid post ID." });

        var result = await pool.query(
            "SELECT * FROM comments WHERE post_id = $1 ORDER BY upvotes DESC, downvotes ASC, created_at DESC",
            [postId]
        );
        res.json({ comments: result.rows.map(mapComment) });

    } catch(err) {
        console.error("Get comments error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/comments", auth, async function(req, res) {
    try {
        var postId  = req.params.id;
        var content = (req.body.content || "").trim();

        if (!isValidId(postId))
            return res.status(400).json({ message: "Invalid post ID." });
        if (!content)
            return res.status(400).json({ message: "Comment cannot be empty." });

        var postExists = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
        if (postExists.rows.length === 0)
            return res.status(404).json({ message: "Post not found." });

        var result = await pool.query(
            `INSERT INTO comments (post_id, user_id, username, content)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [postId, req.userId, req.username, content]
        );
        res.json({ message: "Comment added", comment: mapComment(result.rows[0]) });

    } catch(err) {
        console.error("Create comment error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/comments/:commentId/vote", auth, async function(req, res) {
    try {
        var commentId = req.params.commentId;
        var voteType  = req.body.type; // "up" or "down"

        if (!["up", "down"].includes(voteType))
            return res.status(400).json({ message: "Vote type must be 'up' or 'down'." });
        if (!isValidId(commentId))
            return res.status(400).json({ message: "Invalid comment ID." });

        var existing = await pool.query("SELECT id FROM comments WHERE id = $1", [commentId]);
        if (existing.rows.length === 0)
            return res.status(404).json({ message: "Comment not found." });

        var result = await castVote("comments", "comment_votes", "comment_id", commentId, req.userId, voteType);
        if (result.conflict)
            return res.status(409).json({ message: "You can only change your vote ONCE! You have already changed it." });

        res.json({ message: result.message, comment: mapComment(result.row), canChangeVote: result.canChangeVote });

    } catch(err) {
        console.error("Comment vote error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/comments/:commentId/spam", auth, async function(req, res) {
    try {
        var commentId = req.params.commentId;
        if (!isValidId(commentId))
            return res.status(400).json({ message: "Invalid comment ID." });

        var existing = await pool.query("SELECT id FROM comments WHERE id = $1", [commentId]);
        if (existing.rows.length === 0)
            return res.status(404).json({ message: "Comment not found." });

        var result = await castSpamReport("comments", "comment_spam_reports", "comment_id", commentId, req.userId);
        if (result.conflict)
            return res.status(409).json({ message: "You have already reported this comment." });

        res.json({ message: "Spam reported", comment: mapComment(result.row) });

    } catch(err) {
        console.error("Comment spam report error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

// ── Fallback: serve index.html ─────────────────────────────
app.use(function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ── Start server only after the schema is confirmed ready ──
initDb()
    .then(function() {
        console.log("✅  PostgreSQL connected & schema ready");
        app.listen(3000, function() {
            console.log("🚀  Whispr is live → http://localhost:3000");
            console.log("📄  Open http://localhost:3000 in your browser");
        });
    })
    .catch(function(e) {
        console.error("❌  PostgreSQL error:", e.message);
        process.exit(1);
    });