const axios = require('axios');
const db = require('../config/database');

const BANK_API_URL = 'http://localhost:4000/api';
const LMS_ORG_ACCOUNT = 'LMS-ORG-001';

// Dashboard
exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Check if user has bank account
        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        const hasBankAccount = bankAccounts.length > 0;
        let balance = null;

        if (hasBankAccount) {
            try {
                const response = await axios.get(`${BANK_API_URL}/balance/${bankAccounts[0].account_number}`);
                balance = response.data.balance;
            } catch (error) {
                console.error('Error fetching balance:', error.message);
            }
        }

        // Get enrolled courses
        const [enrollments] = await db.query(`
            SELECT c.*, e.completed, e.enrolled_at
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.learner_id = ?
            ORDER BY e.enrolled_at DESC
        `, [userId]);

        res.render('learner/dashboard', {
            user: req.session,
            hasBankAccount,
            balance,
            enrolledCourses: enrollments
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
            return res.redirect('/learner/dashboard');
        }

        res.render('learner/bank-setup', { user: req.session, error: null });
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
            return res.render('learner/bank-setup', {
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
            return res.redirect('/learner/dashboard');
        }

        // Create bank account with 1000 initial balance
        const response = await axios.post(`${BANK_API_URL}/create-account`, {
            secret,
            initialBalance: 1000
        });

        const accountNumber = response.data.accountNumber;

        // Save to database
        await db.query(
            'INSERT INTO bank_accounts (user_id, account_number) VALUES (?, ?)',
            [userId, accountNumber]
        );

        res.redirect('/learner/dashboard');
    } catch (error) {
        console.error('Bank account creation error:', error);
        res.render('learner/bank-setup', {
            user: req.session,
            error: 'Failed to create bank account. Please try again.'
        });
    }
};

// Browse courses
exports.browseCourses = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get all courses with instructor info
        const [courses] = await db.query(`
            SELECT c.*, u.full_name as instructor_name
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            ORDER BY c.created_at DESC
        `);

        // Get enrolled course IDs
        const [enrollments] = await db.query(
            'SELECT course_id FROM enrollments WHERE learner_id = ?',
            [userId]
        );
        const enrolledIds = enrollments.map(e => e.course_id);

        res.render('learner/courses', {
            user: req.session,
            courses,
            enrolledIds
        });
    } catch (error) {
        console.error('Browse courses error:', error);
        res.status(500).send('Error loading courses');
    }
};

// Course details
exports.courseDetails = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;

        // Get course with instructor
        const [courses] = await db.query(`
            SELECT c.*, u.full_name as instructor_name
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            WHERE c.id = ?
        `, [courseId]);

        if (courses.length === 0) {
            return res.status(404).send('Course not found');
        }

        const course = courses[0];

        // Check if enrolled
        const [enrollments] = await db.query(
            'SELECT * FROM enrollments WHERE learner_id = ? AND course_id = ?',
            [userId, courseId]
        );

        const isEnrolled = enrollments.length > 0;

        // Get material count
        const [materials] = await db.query(
            'SELECT COUNT(*) as count FROM course_materials WHERE course_id = ?',
            [courseId]
        );

        course.materialCount = materials[0].count;

        res.render('learner/course-details', {
            user: req.session,
            course,
            isEnrolled
        });
    } catch (error) {
        console.error('Course details error:', error);
        res.status(500).send('Error loading course');
    }
};

// Purchase course
exports.purchaseCourse = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;
        const { secret } = req.body;

        // Check if already enrolled
        const [existing] = await db.query(
            'SELECT id FROM enrollments WHERE learner_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (existing.length > 0) {
            return res.redirect(`/learner/course/${courseId}`);
        }

        // Get course details
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE id = ?',
            [courseId]
        );

        if (courses.length === 0) {
            return res.status(404).send('Course not found');
        }

        const course = courses[0];

        // Get learner's bank account
        const [bankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [userId]
        );

        if (bankAccounts.length === 0) {
            return res.redirect('/learner/bank-setup');
        }

        const learnerAccount = bankAccounts[0].account_number;

        // Get instructor's bank account
        const [instructorBankAccounts] = await db.query(
            'SELECT account_number FROM bank_accounts WHERE user_id = ?',
            [course.instructor_id]
        );

        // Step 1: Transfer from learner to LMS organization
        const transferResponse = await axios.post(`${BANK_API_URL}/transfer`, {
            fromAccount: learnerAccount,
            toAccount: LMS_ORG_ACCOUNT,
            amount: parseFloat(course.price),
            secret,
            description: `Purchase: ${course.title}`
        });

        if (!transferResponse.data.success) {
            return res.redirect(`/learner/course/${courseId}?error=payment_failed`);
        }

        // Step 2: Create enrollment
        await db.query(
            'INSERT INTO enrollments (learner_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );

        // Step 3: Calculate instructor commission (70%)
        const instructorCommission = parseFloat(course.price) * 0.70;

        // Step 4: Automatically pay instructor commission if they have bank account
        if (instructorBankAccounts.length > 0) {
            try {
                // Immediately transfer 70% commission to instructor
                await axios.post(`${BANK_API_URL}/transfer`, {
                    fromAccount: LMS_ORG_ACCOUNT,
                    toAccount: instructorBankAccounts[0].account_number,
                    amount: instructorCommission,
                    secret: 'admin123', // LMS org secret
                    description: `Commission (70%): ${course.title} sale`
                });
                console.log(`✅ Paid instructor $${instructorCommission.toFixed(2)} commission for ${course.title}`);
            } catch (error) {
                console.error('Instructor commission payment failed:', error.message);
                // Continue anyway - enrollment is already created
            }
        }

        res.redirect(`/learner/course/${courseId}/learn`);
    } catch (error) {
        console.error('Purchase error:', error);
        res.redirect(`/learner/course/${courseId}?error=purchase_failed`);
    }
};

// Learn - access course materials (Sequential Unlock)
exports.learnCourse = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;

        // Check enrollment
        const [enrollments] = await db.query(
            'SELECT * FROM enrollments WHERE learner_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (enrollments.length === 0) {
            return res.redirect(`/learner/course/${courseId}`);
        }

        const enrollment = enrollments[0];

        // Get course
        const [courses] = await db.query(
            'SELECT * FROM courses WHERE id = ?',
            [courseId]
        );

        const course = courses[0];

        // Get materials ordered by index
        const [materials] = await db.query(
            'SELECT * FROM course_materials WHERE course_id = ? ORDER BY order_index ASC',
            [courseId]
        );

        // Get material progress for this enrollment
        const [progress] = await db.query(
            'SELECT material_id, completed FROM material_progress WHERE enrollment_id = ?',
            [enrollment.id]
        );

        const completedMaterialIds = progress.filter(p => p.completed).map(p => p.material_id);

        // Add unlock status to each material
        for (let i = 0; i < materials.length; i++) {
            const material = materials[i];
            const isCompleted = completedMaterialIds.includes(material.id);

            // First material is always unlocked, others unlock when previous is completed
            let isUnlocked = false;
            if (i === 0) {
                isUnlocked = true; // First material always unlocked
            } else {
                const previousMaterial = materials[i - 1];
                isUnlocked = completedMaterialIds.includes(previousMaterial.id);
            }

            material.completed = isCompleted;
            material.unlocked = isUnlocked;
        }

        // Check if all materials are completed
        const allCompleted = materials.length > 0 && materials.every(m => m.completed);

        // If all completed and no certificate exists, show certificate unlock
        let certificate = null;
        if (allCompleted) {
            const [certificates] = await db.query(
                'SELECT * FROM certificates WHERE enrollment_id = ?',
                [enrollment.id]
            );
            certificate = certificates.length > 0 ? certificates[0] : null;
        }

        res.render('learner/learn', {
            user: req.session,
            course,
            materials,
            enrollment,
            certificate,
            allCompleted
        });
    } catch (error) {
        console.error('Learn error:', error);
        res.status(500).send('Error loading course');
    }
};

// Complete course
exports.completeCourse = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;

        // Get enrollment
        const [enrollments] = await db.query(
            'SELECT * FROM enrollments WHERE learner_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (enrollments.length === 0) {
            return res.status(403).send('Not enrolled');
        }

        const enrollment = enrollments[0];

        // Mark as completed
        await db.query(
            'UPDATE enrollments SET completed = TRUE, completed_at = NOW() WHERE id = ?',
            [enrollment.id]
        );

        // Generate certificate
        const certificateCode = `CERT-${Date.now()}-${enrollment.id}`;
        await db.query(
            'INSERT INTO certificates (enrollment_id, certificate_code) VALUES (?, ?)',
            [enrollment.id, certificateCode]
        );

        res.redirect(`/learner/course/${courseId}/learn`);
    } catch (error) {
        console.error('Complete course error:', error);
        res.status(500).send('Error completing course');
    }
};

// View certificate
exports.viewCertificate = async (req, res) => {
    try {
        const userId = req.session.userId;
        const enrollmentId = req.params.id;

        // Get certificate with course and user info
        const [certificates] = await db.query(`
            SELECT cert.*, c.title as course_title, u.full_name as learner_name, e.completed_at
            FROM certificates cert
            JOIN enrollments e ON cert.enrollment_id = e.id
            JOIN courses c ON e.course_id = c.id
            JOIN users u ON e.learner_id = u.id
            WHERE cert.enrollment_id = ? AND e.learner_id = ?
        `, [enrollmentId, userId]);

        if (certificates.length === 0) {
            return res.status(404).send('Certificate not found');
        }

        res.render('learner/certificate', {
            user: req.session,
            certificate: certificates[0]
        });
    } catch (error) {
        console.error('Certificate error:', error);
        res.status(500).send('Error loading certificate');
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

// Mark material as complete
exports.completeMaterial = async (req, res) => {
    try {
        const userId = req.session.userId;
        const courseId = req.params.id;
        const materialId = req.params.materialId;

        // Get enrollment
        const [enrollments] = await db.query(
            'SELECT * FROM enrollments WHERE learner_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (enrollments.length === 0) {
            return res.status(403).send('Not enrolled');
        }

        const enrollment = enrollments[0];

        // Insert or update progress
        await db.query(
            'INSERT INTO material_progress (enrollment_id, material_id, completed, completed_at) VALUES (?, ?, TRUE, NOW()) ON DUPLICATE KEY UPDATE completed = TRUE, completed_at = NOW()',
            [enrollment.id, materialId]
        );

        console.log(`✅ Learner completed material ${materialId} in course ${courseId}`);
        res.redirect(`/learner/course/${courseId}/learn`);
    } catch (error) {
        console.error('Complete material error:', error);
        res.status(500).send('Error completing material');
    }
};
