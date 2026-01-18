const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const { requireRole } = require('../middleware/auth');

// All routes require instructor role
router.use(requireRole('instructor'));

router.get('/dashboard', instructorController.dashboard);
router.get('/bank-setup', instructorController.showBankSetup);
router.post('/bank-setup', instructorController.createBankAccount);
router.get('/upload-course', instructorController.showUploadCourse);
router.post('/upload-course', instructorController.uploadCourse);
router.get('/my-courses', instructorController.myCourses);
router.get('/balance', instructorController.checkBalance);
router.get('/course/:id/materials', instructorController.manageMaterials);
router.post('/course/:id/material/add', instructorController.addMaterial);
router.post('/course/:id/material/:materialId/delete', instructorController.deleteMaterial);

module.exports = router;
