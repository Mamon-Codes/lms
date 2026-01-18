const express = require('express');
const router = express.Router();
const learnerController = require('../controllers/learnerController');
const { requireRole } = require('../middleware/auth');

// All routes require learner role
router.use(requireRole('learner'));

router.get('/dashboard', learnerController.dashboard);
router.get('/bank-setup', learnerController.showBankSetup);
router.post('/bank-setup', learnerController.createBankAccount);
router.get('/courses', learnerController.browseCourses);
router.get('/course/:id', learnerController.courseDetails);
router.post('/course/:id/purchase', learnerController.purchaseCourse);
router.get('/course/:id/learn', learnerController.learnCourse);
router.post('/course/:id/material/:materialId/complete', learnerController.completeMaterial);
router.post('/course/:id/complete', learnerController.completeCourse);
router.get('/certificate/:id', learnerController.viewCertificate);
router.get('/balance', learnerController.checkBalance);

module.exports = router;

