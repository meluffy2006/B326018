

        var result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        var user = result.rows[0];
        if (!user || !verifyPassword(password, user.password))
            return res.status(403).json({ message: "Invalid username or password." });

        var token = jwt.sign(
            { id: String(user.id), username: user.username },