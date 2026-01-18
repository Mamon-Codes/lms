const bcrypt = require('bcrypt');
const db = require('../config/database');

// Show login page
exports.showLogin = (req, res) => {
    res.render('auth/login', { error: null });
};

// Handle login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Get user
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.render('auth/login', { error: 'Invalid email or password' });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.render('auth/login', { error: 'Invalid email or password' });
        }

        // Create session
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.fullName = user.full_name;
        req.session.role = user.role;

        // Redirect based on role
        res.redirect(`/${user.role}/dashboard`);
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { error: 'Login failed. Please try again.' });
    }
};

// Show register page
exports.showRegister = (req, res) => {
    res.render('auth/register', { error: null });
};

// Handle registration
exports.register = async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;

        // Validate role
        if (!['learner', 'instructor'].includes(role)) {
            return res.render('auth/register', { error: 'Invalid role selected' });
        }

        // Check if email already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.render('auth/register', { error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await db.query(
            'INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, fullName, role]
        );

        res.redirect('/login?registered=true');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', { error: 'Registration failed. Please try again.' });
    }
};

// Handle logout
exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/login');
};
