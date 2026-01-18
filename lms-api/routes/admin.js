const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireRole } = require('../middleware/auth');

// All routes require admin role
router.use(requireRole('admin'));

router.get('/dashboard', adminController.dashboard);
router.post('/course/:id/delete', adminController.deleteCourse);

module.exports = router;
