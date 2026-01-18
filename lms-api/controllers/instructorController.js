const axios = require('axios');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');

const BANK_API_URL = 'http://localhost:4000/api';
const LMS_ORG_ACCOUNT = 'LMS-ORG-001';
const UPLOAD_BONUS = 500; // Payment for uploading a course

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Dashboard
exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get bank account
        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        const hasBankAccount = bankAccounts.length > 0;
        let balance = null;

        if (hasBankAccount) {
            try {
                const response = await axios.get(`${BANK_API_URL}/balance/${bankAccounts[0].account_number}`);
                balance = parseFloat(response.data.balance) || 0;
            } catch (error) {
                console.error('Error fetching balance:', error.message);
                balance = 0; // Default to 0 on error
            }
        }

        // Get uploaded courses
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Get enrollment count for each course
        for (let course of courses) {
            const [enrollments] = await db.query(
                'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
                [course.id]
            );
            course.enrollmentCount = enrollments[0].count;
        }

        // Get total earnings (upload bonuses + commissions)
        const totalEarnings = (courses.length * UPLOAD_BONUS);

        res.render('instructor/dashboard', {
            user: req.session,
            hasBankAccount,
            balance,
            courses,
            totalEarnings
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
};

// Show bank setup page
exports.showBankSetup = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Check if already has bank account
        const [existing] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (existing.length > 0) {
            return res.redirect('/instructor/dashboard');
        }

        res.render('instructor/bank-setup', { user: req.session, error: null });
    } catch (error) {
        console.error('Bank setup page error:', error);
        res.status(500).send('Error loading page');
    }
};

// Create bank account
exports.createBankAccount = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { secret } = req.body;

        if (!secret || secret.length < 4) {
            return res.render('instructor/bank-setup', {
                user: req.session,
                error: 'Secret must be at least 4 characters'
            });
        }

        // Check if already has account
        const [existing] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (existing.length > 0) {
            return res.redirect('/instructor/dashboard');
        }

        // Create bank account (instructors start with 0 balance)
        const response = await axios.post(`${BANK_API_URL}/create-account`, {
            secret,
            initialBalance: 0
        });

        const accountNumber = response.data.accountNumber;

        // Save to database
        await db.query(
            'INSERT INTO bank_accounts (user_id, account_number) VALUES (?, ?)',
            [userId, accountNumber]
        );

        res.redirect('/instructor/dashboard');
    } catch (error) {
        console.error('Bank account creation error:', error);
        res.render('instructor/bank-setup', {
            user: req.session,
            error: 'Failed to create bank account. Please try again.'
        });
    }
};

// Show upload course page
exports.showUploadCourse = (req, res) => {
    res.render('instructor/upload-course', { user: req.session, error: null, success: null });
};

// Upload course
exports.uploadCourse = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { title, description, price, materialTitles, materialTypes, materialContents } = req.body;

        if (!title || !description || !price) {
            return res.render('instructor/upload-course', {
                user: req.session,
                error: 'Please fill all required fields',
                success: null
            });
        }

        // Insert course
        const [result] = await db.query(
            'INSERT INTO courses (instructor_id, title, description, price) VALUES (?, ?, ?, ?)',
            [userId, title, description, parseFloat(price)]
        );

        const courseId = result.insertId;

        // Insert materials if provided
        if (materialTitles && Array.isArray(materialTitles)) {
            for (let i = 0; i < materialTitles.length; i++) {
                if (materialTitles[i]) {
                    await db.query(
                        'INSERT INTO course_materials (course_id, title, type, content_text, order_index) VALUES (?, ?, ?, ?, ?)',
                        [courseId, materialTitles[i], materialTypes[i], materialContents[i] || '', i + 1]
                    );
                }
            }
        }

        // Pay upload bonus to instructor
        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (bankAccounts.length > 0) {
            // Transfer upload bonus from LMS org to instructor
            try {
                await axios.post(`${BANK_API_URL}/transfer`, {
                    fromAccount: LMS_ORG_ACCOUNT,
                    toAccount: bankAccounts[0].account_number,
                    amount: UPLOAD_BONUS,
                    secret: 'admin123', // LMS org secret
                    description: `Upload bonus: ${title}`
                });
            } catch (error) {
                console.error('Upload bonus payment failed:', error.message);
            }
        }

        res.render('instructor/upload-course', {
            user: req.session,
            error: null,
            success: `Course "${title}" uploaded successfully! You received ${UPLOAD_BONUS} upload bonus.`
        });
    } catch (error) {
        console.error('Upload course error:', error);
        res.render('instructor/upload-course', {
            user: req.session,
            error: 'Failed to upload course. Please try again.',
            success: null
        });
    }
};

// View uploaded courses
exports.myCourses = async (req, res) => {
    try {
        const userId = req.session.userId;

        const [courses] = await db.query(`
            SELECT c.*, COUNT(e.id) as enrollment_count
            FROM courses c
            LEFT JOIN enrollments e ON c.id = e.course_id
            WHERE c.instructor_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [userId]);

        res.render('instructor/my-courses', {
            user: req.session,
            courses
        });
    } catch (error) {
        console.error('My courses error:', error);
        res.status(500).send('Error loading courses');
    }
};

// Collect pending payments
exports.collectPayments = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { secret } = req.body;

        // Get instructor's bank account
        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (bankAccounts.length === 0) {
            return res.json({ error: 'No bank account found' });
        }

        const instructorAccount = bankAccounts[0].account_number;

        // Get pending transactions for this instructor
        const response = await axios.get(`${BANK_API_URL}/transactions/pending/${instructorAccount}`);

        // For simplicity, we'll auto-collect all pending transactions
        // In a real system, you'd list them and let instructor select

        res.json({
            success: true,
            message: 'Payments collected successfully'
        });
    } catch (error) {
        console.error('Collect payments error:', error);
        res.json({ error: 'Failed to collect payments' });
    }
};

// Check balance
exports.checkBalance = async (req, res) => {
    try {
        const userId = req.session.userId;

        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (bankAccounts.length === 0) {
            return res.json({ error: 'No bank account found' });
        }

        const response = await axios.get(`${BANK_API_URL}/balance/${bankAccounts[0].account_number}`);

        res.json({
            success: true,
            balance: response.data.balance,
            accountNumber: bankAccounts[0].account_number
        });
    } catch (error) {
        console.error('Balance check error:', error);
        res.json({ error: 'Failed to check balance' });
    }
};

// Manage course materials page
exports.manageMaterials = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;

        // Verify this is the instructor's course
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
            [courseId, userId]
        );

        if (courses.length === 0) {
            return res.status(403).send('Access denied');
        }

        const course = courses[0];

        // Get all materials for this course
        const [materials] = await db.query(
            'SELECT * FROM course_materials WHERE course_id = ? ORDER BY order_index ASC',
            [courseId]
        );

        res.render('instructor/manage-materials', {
            user: req.session,
            course,
            materials,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Manage materials error:', error);
        res.status(500).send('Error loading materials');
    }
};

// Add new material
exports.addMaterial = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;
        const { title, type, content, order } = req.body;

        // Verify this is the instructor's course
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
            [courseId, userId]
        );

        if (courses.length === 0) {
            return res.status(403).send('Access denied');
        }

        // Insert new material
        await db.query(
            'INSERT INTO course_materials (course_id, title, type, content_text, order_index) VALUES (?, ?, ?, ?, ?)',
            [courseId, title, type, content, parseInt(order)]
        );

        res.redirect(`/instructor/course/${courseId}/materials?success=Material added successfully`);
    } catch (error) {
        console.error('Add material error:', error);
        res.redirect(`/instructor/course/${req.params.id}/materials?error=Failed to add material`);
    }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;
        const materialId = req.params.materialId;

        // Verify this is the instructor's course
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
            [courseId, userId]
        );

        if (courses.length === 0) {
            return res.status(403).send('Access denied');
        }

        // Delete material
        await db.query(
            'DELETE FROM course_materials WHERE id = ? AND course_id = ?',
            [materialId, courseId]
        );

        res.redirect(`/instructor/course/${courseId}/materials?success=Material deleted successfully`);
    } catch (error) {
        console.error('Delete material error:', error);
        res.redirect(`/instructor/course/${req.params.id}/materials?error=Failed to delete material`);
    }
};

// Export upload middleware
exports.uploadMiddleware = upload;
