👻 Whispr

Anonymous Voice — Share Freely. Discuss Honestly.

Whispr is an anonymous, Reddit-style discussion platform designed for users who want to share opinions, experiences, and ideas without publicly revealing their real identity.

Users can create anonymous accounts, publish posts, add images/videos, comment on discussions, vote on posts and comments, and report spam.

⸻

✨ Features

🔐 Authentication

* Anonymous username-based registration and login
* JWT-based authentication
* Protected API routes
* Automatic authentication using Bearer tokens
* JWT tokens expire after 7 days

The authentication middleware reads the Authorization header and verifies the JWT before allowing access to protected routes.

📝 Posts

Users can:

* Create posts
* Add a title and content
* Select a topic
* View all posts
* View their own posts
* Delete their own posts
* View post voting statistics
* Attach images and videos

Posts are returned with information such as username, topic, votes, spam reports, creation time, and media information.

💬 Comments

Users can:

* Add comments to posts
* View comments
* Upvote comments
* Downvote comments
* Report comments as spam

Comments are stored separately from posts and are connected using the post ID.

👍 Voting System

Whispr supports:

* 👍 Upvotes
* 👎 Downvotes
* One vote per user
* Removing the same vote
* One allowed change from one vote type to the opposite

The voting system is implemented for both posts and comments.

🚨 Spam Reporting

Users can report:

* Posts as spam
* Comments as spam

A user cannot repeatedly report the same post or comment. The database stores individual reports to prevent duplicate reports.

📸 Media Uploads

Posts support:

* Images
* Videos
* Multiple media files
* Drag-and-drop uploads
* Media previews
* Removing selected media before publishing

The current implementation accepts image and video media types and applies a 5 MB per-file limit.

The frontend supports multiple file selection and displays uploaded images and videos directly inside posts.

🎨 Modern UI

The frontend uses:

* Dark glassmorphism design
* Responsive layout
* Animated backgrounds
* Gradient buttons
* Glass cards
* Toast notifications
* Responsive authentication page
* Mobile-friendly layout

The main design system uses Inter typography, glass cards, gradients, and animated backgrounds.

⸻

🛠️ Tech Stack

Frontend

* HTML5
* CSS3
* JavaScript
* Responsive CSS
* Font Awesome
* Google Fonts

Backend

* Node.js
* Express.js
* JSON Web Token (JWT)
* CORS
* dotenv

Database

* PostgreSQL
* pg Node.js driver

The project dependencies are defined in package.json.

⸻

📁 Project Structure

whispr/
│
├── index.html
├── forum-app.html
├── style.css
│
├── index.js
├── auth.js
├── db.js
│
├── package.json
├── package-lock.json
│
├── MEDIA_UPLOAD_FEATURE.md
├── .env
└── README.md

File Description

File	Purpose
index.html	Login and registration page
forum-app.html	Main Whispr forum interface
style.css	Global styling and design system
index.js	Express server and API routes
auth.js	JWT authentication middleware
db.js	PostgreSQL connection and database schema
package.json	Project configuration and dependencies
.env	Environment variables
README.md	Project documentation

⸻

🗄️ Database Structure

Whispr uses PostgreSQL.

The application automatically initializes the required database tables when the server starts.

Main Tables

users
posts
comments
post_votes
comment_votes
post_spam_reports
comment_spam_reports

Users

users
├── id
├── username
├── password
└── created_at

Posts

posts
├── id
├── user_id
├── username
├── title
├── content
├── topic
├── media_urls
├── media_types
├── upvotes
├── downvotes
├── spam_reports
└── created_at

Comments

comments
├── id
├── post_id
├── user_id
├── username
├── content
├── upvotes
├── downvotes
├── spam_reports
└── created_at

The database uses foreign keys to connect users, posts, comments, votes, and spam reports.

⸻

🔄 Application Flow

                    ┌──────────────────┐
                    │      User        │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Login/Register  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   JWT Token      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Whispr Forum   │
                    └────────┬─────────┘
                             │
             ┌───────────────┼────────────────┐
             ▼               ▼                ▼
        ┌─────────┐     ┌──────────┐    ┌──────────┐
        │  Posts  │     │ Comments │    │  Media   │
        └────┬────┘     └────┬─────┘    └────┬─────┘
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                    ┌──────────────────┐
                    │    PostgreSQL    │
                    └──────────────────┘

⸻

🚀 Installation

1. Clone the Repository

git clone https://github.com/YOUR-USERNAME/whispr.git

Move into the project:

cd whispr

⸻

2. Install Dependencies

Make sure Node.js is installed.

Then run:

npm install

The project uses Express, PostgreSQL, JWT, CORS, and dotenv.

⸻

🔑 Environment Variables

Create a .env file in the project root.

DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/whispr

The PostgreSQL connection is read from DATABASE_URL.

Important: Never upload your .env file or database credentials to GitHub.

Add this to .gitignore:

node_modules/
.env

⸻

🐘 PostgreSQL Setup

Create a PostgreSQL database named:

whispr

For example:

createdb whispr

Or create it using pgAdmin/PostgreSQL tools.

You do not need to manually create the tables. The application runs the database initialization when the server starts.

⸻

▶️ Running the Application

Start the server using:

npm start

The server runs on:

http://localhost:3000

The application starts the Express server only after the PostgreSQL schema has been initialized successfully.

Open:

http://localhost:3000

⸻

🔌 API Endpoints

Authentication

Register

POST /signup

Request:

{
  "username": "anonymous_user",
  "password": "password123"
}

Requirements:

* Username: 3–20 characters
* Password: minimum 6 characters

⸻

Login

POST /signin

Request:

{
  "username": "anonymous_user",
  "password": "password123"
}

Successful login returns a JWT token:

{
  "token": "JWT_TOKEN",
  "username": "anonymous_user"
}

⸻

📝 Post API

Get All Posts

GET /posts

Authentication required.

⸻

Get My Posts

GET /posts/mine

Authentication required.

⸻

Create Post

POST /posts

Example:

{
  "title": "My Experience",
  "content": "This is my anonymous opinion.",
  "topic": "General",
  "mediaUrls": [],
  "mediaTypes": []
}

Authentication:

Authorization: Bearer YOUR_TOKEN

⸻

Delete Post

DELETE /posts/:id

Users can only delete their own posts.

⸻

👍 Voting API

Vote on a Post

POST /posts/:id/vote

Request:

{
  "type": "up"
}

or:

{
  "type": "down"
}

⸻

Vote on a Comment

POST /posts/:id/comments/:commentId/vote

Request:

{
  "type": "up"
}

⸻

🚨 Spam Reporting API

Report Post

POST /posts/:id/spam

Report Comment

POST /posts/:id/comments/:commentId/spam

A user can report a particular post or comment only once.

⸻

💬 Comment API

Get Comments

GET /posts/:id/comments

Add Comment

POST /posts/:id/comments

Request:

{
  "content": "This is an interesting discussion."
}

⸻

📸 Media API

Posts can contain media using:

{
  "mediaUrls": [
    "data:image/png;base64,...",
    "data:video/mp4;base64,..."
  ],
  "mediaTypes": [
    "image",
    "video"
  ]
}

Current restrictions:

Maximum file size: 5 MB
Supported types: image / video
Maximum files per post: 10

The frontend provides previews before the post is submitted.

⸻

🔐 Authentication Flow

User
  │
  ▼
Login / Register
  │
  ▼
Express Backend
  │
  ▼
PostgreSQL
  │
  ▼
JWT Token
  │
  ▼
Frontend stores token
  │
  ▼
Authorization: Bearer <token>
  │
  ▼
Auth Middleware
  │
  ▼
Protected API Route

Protected requests are validated by the JWT authentication middleware before continuing to the requested route.

⸻

🎯 Project Goals

Whispr is designed around the idea of providing a platform where users can:

* Express opinions anonymously
* Participate in discussions
* Share experiences
* Discuss organizations and communities
* Interact through comments
* Identify useful/authentic content through community voting
* Report spam or inappropriate content
* Share images and videos

The login page describes the platform as a space for sharing honest opinions about organizations, workplaces, and communities anonymously.

⸻

🧪 Testing Checklist

Before deploying, test:

Authentication

* Register a new user
* Register with an existing username
* Login with correct credentials
* Login with incorrect credentials
* Access protected routes without a token

Posts

* Create a post
* View posts
* View personal posts
* Delete own post
* Try deleting another user’s post

Comments

* Add a comment
* View comments
* Vote on comments
* Report a comment

Voting

* Upvote a post
* Downvote a post
* Remove a vote
* Change vote
* Test the vote-change restriction

Media

* Upload an image
* Upload a video
* Upload multiple files
* Preview media
* Remove media before posting
* Test a file larger than 5 MB
* Test unsupported media types

⸻

⚠️ Important Security Notes

Before deploying this project publicly, review the authentication implementation.

The current source contains a JWT secret directly inside auth.js, so it should be moved to an environment variable before production deployment.

Also, the current signup/signin implementation stores and checks passwords directly in the database. For a production application, passwords should be securely hashed using a modern password-hashing algorithm such as Argon2 or bcrypt.

Do not use the current authentication implementation unchanged for a production deployment.

⸻

🚧 Future Improvements

Possible future improvements include:

* Secure password hashing
* Move JWT secret to .env
* Password reset
* Email verification
* User profiles
* Search functionality
* Post categories
* Notifications
* Real-time comments
* WebSocket-based chat
* Image compression
* Cloud media storage
* Cloudinary / AWS S3 integration
* Pagination
* Infinite scrolling
* Admin moderation dashboard
* Content moderation
* Rate limiting
* Better API validation
* Production deployment

For media-heavy production usage, external storage and compression would also be preferable to storing large Base64 strings directly in the database. The uploaded media documentation specifically identifies Base64 overhead and suggests external storage for larger-scale deployments.

⸻

📌 Current Project Status

Frontend        ✅ Implemented
Backend         ✅ Implemented
PostgreSQL      ✅ Implemented
JWT Auth        ✅ Implemented
Posts           ✅ Implemented
Comments        ✅ Implemented
Voting          ✅ Implemented
Spam Reports    ✅ Implemented
Image Upload    ✅ Implemented
Video Upload    ✅ Implemented
Responsive UI   ✅ Implemented
Production Auth ⚠️ Requires security improvements

⸻

👨‍💻 Author

Whispr — Anonymous Voice

Built as a full-stack web application using:

HTML
CSS
JavaScript
Node.js
Express.js
PostgreSQL
JWT

⸻

📄 License

This project is intended for educational and development purposes.

Add an appropriate open-source license, such as MIT, if you plan to distribute the project publicly.
