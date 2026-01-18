const db = require('../config/database');
const axios = require('axios');

const BANK_API_URL = 'http://localhost:4000/api';

// Dashboard
exports.dashboard = async (req, res) => {
    try {
        // Get total statistics
        const [userStats] = await db.query(
            'SELECT role, COUNT(*) as count FROM users GROUP BY role'
        );

        const [courseStats] = await db.query(
            'SELECT COUNT(*) as count FROM courses'
        );

        const [enrollmentStats] = await db.query(
            'SELECT COUNT(*) as count FROM enrollments'
        );

        const [certificateStats] = await db.query(
            'SELECT COUNT(*) as count FROM certificates'
        );

        // Get recent enrollments
        const [recentEnrollments] = await db.query(`
            SELECT e.*, u.full_name as learner_name, c.title as course_title
            FROM enrollments e
            JOIN users u ON e.learner_id = u.id
            JOIN courses c ON e.course_id = c.id
            ORDER BY e.enrolled_at DESC
            LIMIT 10
        `);

        // Get all courses
        const [courses] = await db.query(`
            SELECT c.*, u.full_name as instructor_name, COUNT(e.id) as enrollment_count
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            LEFT JOIN enrollments e ON c.id = e.course_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);

        // Get LMS organization balance
        let lmsBalance = 0;
        try {
            const response = await axios.get(`${BANK_API_URL}/balance/LMS-ORG-001`);
            lmsBalance = parseFloat(response.data.balance) || 0;
        } catch (error) {
            console.error('Error fetching LMS balance:', error.message);
        }

        // Get all users with their bank accounts and balances
        const [allUsers] = await db.query(`
            SELECT u.id, u.email, u.full_name, u.role, ba.account_number
            FROM users u
            LEFT JOIN bank_accounts ba ON u.id = ba.user_id
            WHERE u.role != 'admin'
            ORDER BY u.role, u.full_name
        `);

        // Fetch balance for each user who has a bank account
        for (let user of allUsers) {
            if (user.account_number) {
                try {
                    const response = await axios.get(`${BANK_API_URL}/balance/${user.account_number}`);
                    user.balance = parseFloat(response.data.balance) || 0;
                } catch (error) {
                    user.balance = null;
                }
            } else {
                user.balance = null; // No bank account
            }
        }

        res.render('admin/dashboard', {
            user: req.session,
            userStats,
            courseCount: courseStats[0].count,
            enrollmentCount: enrollmentStats[0].count,
            certificateCount: certificateStats[0].count,
            recentEnrollments,
            courses,
            lmsBalance,
            allUsers
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
};

// Delete course
exports.deleteCourse = async (req, res) => {
    try {
        const courseId = req.params.id;

        // Delete course (CASCADE will handle enrollments, materials, certificates)
        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);

        console.log(`🗑️ Admin deleted course ID: ${courseId}`);
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).send('Error deleting course');
    }
};
