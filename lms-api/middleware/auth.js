// Authentication middleware

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect('/login');
        }

        if (req.session.role !== role) {
            return res.status(403).send('Access denied. Insufficient permissions.');
        }

        next();
    };
}

function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        const role = req.session.role;
        return res.redirect(`/${role}/dashboard`);
    }
    next();
}

module.exports = {
    requireAuth,
    requireRole,
    redirectIfAuthenticated
};
