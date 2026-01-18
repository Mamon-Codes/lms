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
