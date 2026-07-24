const express  = require("express");
const cors     = require("cors");
const crypto   = require("crypto");   // built-in Node.js — no install needed
const jwt      = require("jsonwebtoken");
const mongoose = require("mongoose");
const path     = require("path");

const { UserModel, PostModel, CommentModel } = require("./db");
const { auth, JWT_SECRET } = require("./auth");
const { Types: { ObjectId } } = require("mongoose");

// ─────────────────────────────────────────────────────────────
// IMPORTANT: Replace <db_password> with your real MongoDB Atlas password
// ─────────────────────────────────────────────────────────────
mongoose.connect("mongodb+srv://omsombehera2011_db_user:E25acLZIOLk99hS9@anomydb.ytdgix2.mongodb.net/anomy")
    .then(function()  { console.log("✅  MongoDB connected"); })
    .catch(function(e){ console.error("❌  MongoDB error:", e.message); process.exit(1); });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve all HTML/CSS/JS files from the same folder as index.js
app.use(express.static(path.join(__dirname)));

// ── Password helpers using built-in crypto (no bcryptjs needed) ──
function hashPassword(password) {
    var salt = crypto.randomBytes(16).toString("hex");
    var hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return hash + ":" + salt;
}
function verifyPassword(password, stored) {
    var parts = stored.split(":");
    var hash  = parts[0];
    var salt  = parts[1];
    var check = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return check === hash;
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

        var existing = await UserModel.findOne({ username: username });
        if (existing)
            return res.status(409).json({ message: "That username is already taken. Try another." });

        await UserModel.create({ username: username, password: hashPassword(password) });
        res.json({ message: "Account created! You can now sign in." });

    } catch(err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

app.post("/signin", async function(req, res) {
    try {
        var username = (req.body.username || "").trim();
        var password =  req.body.password || "";

        var user = await UserModel.findOne({ username: username });
        if (!user || !verifyPassword(password, user.password))
            return res.status(403).json({ message: "Invalid username or password." });

        var token = jwt.sign(
            { id: user._id.toString(), username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.json({ token: token, username: user.username });

    } catch(err) {
        console.error("Signin error:", err);
        res.status(500).json({ message: "Server error. Please try again." });
    }
});

// ══════════════════════════════════════════════════════════════
//  POST ROUTES
// ══════════════════════════════════════════════════════════════

app.get("/posts", auth, async function(req, res) {
    try {
        var posts = await PostModel.find().sort({ upvotes: -1, downvotes: 1, createdAt: -1 });
        
        // Add trending label & calculate net votes for better ranking
        var postsWithTrending = posts.map(post => {
            var postObj = post.toObject();
            var netVotes = post.upvotes - post.downvotes;
            // Posts with upvotes > 45 are marked as trending
            postObj.isTrending = post.upvotes > 45;
            postObj.netVotes = netVotes;
            return postObj;
        });
        
        res.json({ posts: postsWithTrending });
    } catch(err) { res.status(500).json({ message: "Server error." }); }
});

app.get("/posts/mine", auth, async function(req, res) {
    try {
        var posts = await PostModel.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json({ posts: posts });
    } catch(err) { res.status(500).json({ message: "Server error." }); }
});

app.post("/posts", auth, async function(req, res) {
    try {
        var title   = (req.body.title   || "").trim();
        var content = (req.body.content || "").trim();
        var topic   =  req.body.topic   || "General";
        var mediaUrls = req.body.mediaUrls || [];  // Array of base64 strings or file URLs
        var mediaTypes = req.body.mediaTypes || []; // Array of "image" or "video"

        if (!title || !content)
            return res.status(400).json({ message: "Title and content are required." });

        // Validate media arrays have same length
        if (mediaUrls.length !== mediaTypes.length)
            return res.status(400).json({ message: "Media URLs and types must match." });

        // Validate media types and size
        var MAX_SIZE = 5 * 1024 * 1024; // 5MB per file
        for (var i = 0; i < mediaUrls.length; i++) {
            if (!["image", "video"].includes(mediaTypes[i]))
                return res.status(400).json({ message: "Media type must be 'image' or 'video'." });
            
            // Check base64 size (rough estimate: base64 is ~33% larger than binary)
            if (mediaUrls[i].startsWith("data:")) {
                var sizeEstimate = mediaUrls[i].length * 0.75;
                if (sizeEstimate > MAX_SIZE)
                    return res.status(400).json({ message: "Media file too large. Max 5MB per file." });
            }
        }

        var post = await PostModel.create({
            userId: req.userId, username: req.username,
            title: title, content: content, topic: topic,
            mediaUrls: mediaUrls, mediaTypes: mediaTypes
        });
        res.json({ message: "Post created", post: post });

    } catch(err) {
        console.error("Create post error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.delete("/posts/:id", auth, async function(req, res) {
    try {
        var post = await PostModel.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.userId.toString() !== req.userId)
            return res.status(403).json({ message: "You can only delete your own posts." });

        await PostModel.findByIdAndDelete(req.params.id);
        await CommentModel.deleteMany({ postId: req.params.id });
        res.json({ message: "Post deleted." });

    } catch(err) { res.status(500).json({ message: "Server error." }); }
});

app.post("/posts/:id/vote", auth, async function(req, res) {
    try {
        var postId = req.params.id;
        var voteType = req.body.type; // "up" or "down"

        if (!["up", "down"].includes(voteType)) {
            return res.status(400).json({ message: "Vote type must be 'up' or 'down'." });
        }

        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ message: "Invalid post ID." });
        }

        var post = await PostModel.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });

        var userIdStr = req.userId.toString();
        if (!ObjectId.isValid(userIdStr)) {
            return res.status(400).json({ message: "Invalid user ID in token. Please sign in again." });
        }
        var userObjectId = new ObjectId(userIdStr);
        
        // Check if user has already voted
        var userCurrentVote = post.userVotes.get(userIdStr);
        var hasVotedBefore = userCurrentVote !== undefined;
        var hasAlreadyChanged = post.userVoteChanged.get(userIdStr) || false;

        // ════════════════════════════════════════════════════════════
        // CASE 1: User hasn't voted yet (FIRST VOTE)
        // ════════════════════════════════════════════════════════════
        if (!hasVotedBefore) {
            var inc = voteType === "up" ? { upvotes: 1 } : { downvotes: 1 };
            var setObj = {};
            setObj[`userVotes.${userIdStr}`] = voteType;
            setObj[`userVoteChanged.${userIdStr}`] = false;
            
            var updatedPost = await PostModel.findByIdAndUpdate(
                postId,
                { 
                    $inc: inc,
                    $push: { votedUsers: userObjectId },
                    $set: setObj
                },
                { new: true }
            );
            
            return res.json({ 
                message: "Vote recorded successfully", 
                post: updatedPost,
                canChangeVote: true  // User can change this vote once
            });
        }

        // ════════════════════════════════════════════════════════════
        // CASE 2: User already voted - trying to change or remove
        // ════════════════════════════════════════════════════════════
        
        // CASE 2A: User clicks SAME vote type (wants to remove vote)
        if (userCurrentVote === voteType) {
            var dec = voteType === "up" ? { upvotes: -1 } : { downvotes: -1 };
            var unsetObj = {};
            unsetObj[`userVotes.${userIdStr}`] = 1;
            unsetObj[`userVoteChanged.${userIdStr}`] = 1;
            
            var updatedPost = await PostModel.findByIdAndUpdate(
                postId,
                { 
                    $inc: dec,
                    $pull: { votedUsers: userObjectId },
                    $unset: unsetObj
                },
                { new: true }
            );
            
            return res.json({ 
                message: "Vote removed successfully", 
                post: updatedPost
            });
        }

        // CASE 2B: User tries to CHANGE vote (upvote to downvote or vice versa)
        if (userCurrentVote !== voteType) {
            
            // Check if they already changed their vote once
            if (hasAlreadyChanged) {
                return res.status(409).json({ 
                    message: "You can only change your vote ONCE! You have already changed it." 
                });
            }

            // Allow the change (first and only time)
            var oldVote = userCurrentVote;
            var oldDec = oldVote === "up" ? { upvotes: -1 } : { downvotes: -1 };
            var newInc = voteType === "up" ? { upvotes: 1 } : { downvotes: 1 };
            var setObj = {};
            setObj[`userVotes.${userIdStr}`] = voteType;
            setObj[`userVoteChanged.${userIdStr}`] = true;
            
            // Combine: remove old vote, add new vote, mark as changed
            var update = { 
                $inc: { ...oldDec, ...newInc },
                $set: setObj
            };
            
            var updatedPost = await PostModel.findByIdAndUpdate(
                postId,
                update,
                { new: true }
            );
            
            return res.json({ 
                message: "Vote changed successfully! (This was your one allowed change)", 
                post: updatedPost,
                canChangeVote: false  // ← No more changes allowed
            });
        }

    } catch(err) {
        console.error("Post vote error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

app.post("/posts/:id/spam", auth, async function(req, res) {
    try {
        var postId = req.params.id;

        var post = await PostModel.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });

        var userIdStr = req.userId.toString();
        if (!ObjectId.isValid(userIdStr)) {
            return res.status(400).json({ message: "Invalid user ID in token. Please sign in again." });
        }
        var userObjectId = new ObjectId(userIdStr);
        var userHasReported = post.spamReportedBy && post.spamReportedBy.some(id => id.toString() === userIdStr);

        if (userHasReported) {
            return res.status(409).json({ message: "You have already reported this post." });
        }

        var updatedPost = await PostModel.findByIdAndUpdate(
            postId,
            { 
                $inc: { spamReports: 1 },
                $push: { spamReportedBy: userObjectId }
            },
            { new: true }
        );

        res.json({ message: "Spam reported", post: updatedPost });

    } catch(err) {
        console.error("Post spam report error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

// ══════════════════════════════════════════════════════════════
//  COMMENT ROUTES - FIXED WITH VOTE LIMITING & TRENDING
// ══════════════════════════════════════════════════════════════

// GET comments sorted by upvotes (trending) - highest first
app.get("/posts/:id/comments", auth, async function(req, res) {
    try {
        var comments = await CommentModel.find({ postId: req.params.id }).sort({ upvotes: -1, downvotes: 1, createdAt: -1 });
        
        // Add trending indicator to comments
        var commentsWithTrending = comments.map(comment => {
            var commentObj = comment.toObject();
            var netVotes = comment.upvotes - comment.downvotes;
            commentObj.isTrending = netVotes >= 3; // Comments with 3+ net upvotes are trending
            commentObj.netVotes = netVotes;
            return commentObj;
        });
        
        res.json({ comments: commentsWithTrending });
    } catch(err) { res.status(500).json({ message: "Server error." }); }
});

// POST new comment
app.post("/posts/:id/comments", auth, async function(req, res) {
    try {
        var content = (req.body.content || "").trim();
        if (!content) return res.status(400).json({ message: "Comment cannot be empty." });

        var comment = await CommentModel.create({
            postId: req.params.id, userId: req.userId,
            username: req.username, content: content
        });
        res.json({ message: "Comment added", comment: comment });

    } catch(err) { res.status(500).json({ message: "Server error." }); }
});

// VOTE on comment - ALLOW VOTE CHANGES ONCE ONLY
app.post("/posts/:id/comments/:commentId/vote", auth, async function(req, res) {
    try {
        var commentId = req.params.commentId;
        var voteType = req.body.type; // "up" or "down"

        if (!["up", "down"].includes(voteType)) {
            return res.status(400).json({ message: "Vote type must be 'up' or 'down'." });
        }

        if (!ObjectId.isValid(commentId)) {
            return res.status(400).json({ message: "Invalid comment ID." });
        }

        var comment = await CommentModel.findById(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found." });

        var userIdStr = req.userId.toString();
        if (!ObjectId.isValid(userIdStr)) {
            return res.status(400).json({ message: "Invalid user ID in token. Please sign in again." });
        }
        var userObjectId = new ObjectId(userIdStr);
        
        // Check if user has already voted
        var userCurrentVote = comment.userVotes.get(userIdStr);
        var hasVotedBefore = userCurrentVote !== undefined;
        var hasAlreadyChanged = comment.userVoteChanged.get(userIdStr) || false;

        // ════════════════════════════════════════════════════════════
        // CASE 1: User hasn't voted yet (FIRST VOTE)
        // ════════════════════════════════════════════════════════════
        if (!hasVotedBefore) {
            var inc = voteType === "up" ? { upvotes: 1 } : { downvotes: 1 };
            var setObj = {};
            setObj[`userVotes.${userIdStr}`] = voteType;
            setObj[`userVoteChanged.${userIdStr}`] = false;
            
            var updatedComment = await CommentModel.findByIdAndUpdate(
                commentId,
                { 
                    $inc: inc,
                    $push: { votedUsers: userObjectId },
                    $set: setObj
                },
                { new: true }
            );
            
            return res.json({ 
                message: "Vote recorded successfully", 
                comment: updatedComment,
                canChangeVote: true
            });
        }

        // ════════════════════════════════════════════════════════════
        // CASE 2: User already voted - trying to change or remove
        // ════════════════════════════════════════════════════════════
        
        // CASE 2A: User clicks SAME vote type (wants to remove vote)
        if (userCurrentVote === voteType) {
            var dec = voteType === "up" ? { upvotes: -1 } : { downvotes: -1 };
            var unsetObj = {};
            unsetObj[`userVotes.${userIdStr}`] = 1;
            unsetObj[`userVoteChanged.${userIdStr}`] = 1;
            
            var updatedComment = await CommentModel.findByIdAndUpdate(
                commentId,
                { 
                    $inc: dec,
                    $pull: { votedUsers: userObjectId },
                    $unset: unsetObj
                },
                { new: true }
            );
            
            return res.json({ 
                message: "Vote removed successfully", 
                comment: updatedComment
            });
        }

        // CASE 2B: User tries to CHANGE vote (upvote to downvote or vice versa)
        if (userCurrentVote !== voteType) {
            
            // Check if they already changed their vote once
            if (hasAlreadyChanged) {
                return res.status(409).json({ 
                    message: "You can only change your vote ONCE! You have already changed it." 
                });
            }

            // Allow the change (first and only time)
            var oldVote = userCurrentVote;
            var oldDec = oldVote === "up" ? { upvotes: -1 } : { downvotes: -1 };
            var newInc = voteType === "up" ? { upvotes: 1 } : { downvotes: 1 };
            var setObj = {};
            setObj[`userVotes.${userIdStr}`] = voteType;
            setObj[`userVoteChanged.${userIdStr}`] = true;
            
            var update = { 
                $inc: { ...oldDec, ...newInc },
                $set: setObj
            };
            
            var updatedComment = await CommentModel.findByIdAndUpdate(
                commentId,
                update,
                { new: true }
            );
            
            return res.json({ 
                message: "Vote changed successfully! (This was your one allowed change)", 
                comment: updatedComment,
                canChangeVote: false
            });
        }

    } catch(err) {
        console.error("Comment vote error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

// SPAM REPORT on comment - ONE REPORT ONLY per user
app.post("/posts/:id/comments/:commentId/spam", auth, async function(req, res) {
    try {
        var commentId = req.params.commentId;

        var comment = await CommentModel.findById(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found." });

        var userIdStr = req.userId.toString();
        if (!ObjectId.isValid(userIdStr)) {
            return res.status(400).json({ message: "Invalid user ID in token. Please sign in again." });
        }
        var userObjectId = new ObjectId(userIdStr);
        var userHasReported = comment.spamReportedBy && comment.spamReportedBy.some(id => id.toString() === userIdStr);

        if (userHasReported) {
            return res.status(409).json({ message: "You have already reported this comment." });
        }

        // Add user to spamReportedBy array and increment spam count
        var updatedComment = await CommentModel.findByIdAndUpdate(
            commentId,
            { 
                $inc: { spamReports: 1 },
                $push: { spamReportedBy: userObjectId }
            },
            { new: true }
        );

        res.json({ message: "Spam reported", comment: updatedComment });

    } catch(err) {
        console.error("Comment spam report error:", err);
        res.status(500).json({ message: "Server error." });
    }
});

// ── Fallback: serve index.html ─────────────────────────────
// ALL routes above

app.use(function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.listen(3000, function() {
    console.log("🚀  Whispr is live → http://localhost:3000");
    console.log("📄  Open http://localhost:3000 in your browser");
});