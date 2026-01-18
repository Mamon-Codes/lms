const express = require('express');
const session = require('express-session');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const learnerRoutes = require('./routes/learner');
const instructorRoutes = require('./routes/instructor');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'lms-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make session available in all views
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/learner', learnerRoutes);
app.use('/instructor', instructorRoutes);
app.use('/admin', adminRoutes);

// Home route - redirect to login
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect(`/${req.session.role}/dashboard`);
    }
    res.redirect('/login');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start server
app.listen(PORT, () => {
    console.log(`🎓 LMS API running on http://localhost:${PORT}`);
    console.log(`📚 Make sure Bank API is running on http://localhost:4000`);
});
