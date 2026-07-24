const mongoose = require("mongoose");
const Schema   = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const UserSchema = new Schema({
    username:  { type: String, unique: true, required: true, trim: true },
    password:  { type: String, required: true },   // stored as pbkdf2 hash:salt
    createdAt: { type: Date, default: Date.now }
});

const PostSchema = new Schema({
    userId:      { type: ObjectId, required: true },
    username:    { type: String,   required: true },
    title:       { type: String,   required: true },
    content:     { type: String,   required: true },
    topic:       { type: String,   default: "General" },
    mediaUrls:   { type: [String], default: [] },  // Array of base64 or file URLs for images/videos
    mediaTypes:  { type: [String], default: [] },  // Array of media types: "image", "video"
    upvotes:     { type: Number,   default: 0 },
    downvotes:   { type: Number,   default: 0 },
    spamReports: { type: Number,   default: 0 },
    votedUsers:  { type: [ObjectId], default: [] },  // Track who voted
    spamReportedBy: { type: [ObjectId], default: [] }, // Track who reported spam
    userVotes:   { type: Map, of: String, default: new Map() }, // { userId: "up"/"down" }
    userVoteChanged: { type: Map, of: Boolean, default: new Map() }, // { userId: true/false } - tracks if already changed vote
    createdAt:   { type: Date,     default: Date.now }
});

const CommentSchema = new Schema({
    postId:      { type: ObjectId, required: true },
    userId:      { type: ObjectId, required: true },
    username:    { type: String,   required: true },
    content:     { type: String,   required: true },
    upvotes:     { type: Number,   default: 0 },
    downvotes:   { type: Number,   default: 0 },
    spamReports: { type: Number,   default: 0 },
    votedUsers:  { type: [ObjectId], default: [] },  // users who voted
    spamReportedBy: { type: [ObjectId], default: [] }, // users who reported spam
    userVotes:   { type: Map, of: String, default: new Map() }, // { userId: "up"/"down" }
    userVoteChanged: { type: Map, of: Boolean, default: new Map() }, // { userId: true/false } - tracks if already changed vote
    createdAt:   { type: Date,     default: Date.now }
});

module.exports = {
    UserModel:    mongoose.model("users",    UserSchema),
    PostModel:    mongoose.model("posts",    PostSchema),
    CommentModel: mongoose.model("comments", CommentSchema)
};