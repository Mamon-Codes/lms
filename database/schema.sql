-- LMS Database Schema
-- Drop and create databases
DROP DATABASE IF EXISTS lms_db;
DROP DATABASE IF EXISTS bank_db;

CREATE DATABASE lms_db;
CREATE DATABASE bank_db;

-- =====================================================
-- LMS DATABASE
-- =====================================================
USE lms_db;

-- Users table (learners, instructors, admin)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('learner', 'instructor', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instructor_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    thumbnail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Course materials (text, audio, video, MCQ)
CREATE TABLE course_materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    type ENUM('text', 'audio', 'video', 'mcq') NOT NULL,
    content_url TEXT,
    content_text TEXT,
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Enrollments
CREATE TABLE enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    learner_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    UNIQUE KEY unique_enrollment (learner_id, course_id),
    FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Bank accounts mapping
CREATE TABLE bank_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Certificates
CREATE TABLE certificates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    enrollment_id INT UNIQUE NOT NULL,
    certificate_code VARCHAR(100) UNIQUE NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert admin user (password: admin123)
INSERT INTO users (email, password, full_name, role) VALUES 
('admin@lms.com', '$2b$10$mH1JQjuiihKe9b27xb583u9uY0MGbbBshDcHLNj2ypZebTZjM.A4G', 'LMS Admin', 'admin');

-- Insert 3 instructors (password: instructor123)
INSERT INTO users (email, password, full_name, role) VALUES 
('instructor1@lms.com', '$2b$10$mA7RhHFY1EzRARJd2DYtD.LrvVCOXHutMegkWZ1PxVNV.hvhS4DK2', 'Dr. Sarah Johnson', 'instructor'),
('instructor2@lms.com', '$2b$10$mA7RhHFY1EzRARJd2DYtD.LrvVCOXHutMegkWZ1PxVNV.hvhS4DK2', 'Prof. Michael Chen', 'instructor'),
('instructor3@lms.com', '$2b$10$mA7RhHFY1EzRARJd2DYtD.LrvVCOXHutMegkWZ1PxVNV.hvhS4DK2', 'Dr. Emily Rodriguez', 'instructor');

-- Insert 5 courses (distributed among instructors)
INSERT INTO courses (instructor_id, title, description, price, thumbnail) VALUES 
(2, 'Introduction to Python Programming', 'Learn Python from scratch with hands-on projects and real-world applications.', 100.00, 'python.jpg'),
(2, 'Web Development with JavaScript', 'Master modern web development with JavaScript, HTML, and CSS.', 150.00, 'webdev.jpg'),
(3, 'Data Science Fundamentals', 'Explore data analysis, visualization, and machine learning basics.', 200.00, 'datascience.jpg'),
(3, 'Mobile App Development', 'Build native mobile apps for iOS and Android platforms.', 250.00, 'mobiledev.jpg'),
(4, 'Cloud Computing with AWS', 'Learn cloud infrastructure, deployment, and DevOps practices.', 300.00, 'cloud.jpg');

-- Insert sample course materials for Course 1 (Python)
INSERT INTO course_materials (course_id, title, type, content_text, order_index) VALUES 
(1, 'Welcome to Python', 'text', 'Python is a versatile programming language used in web development, data science, AI, and more. This course will teach you the fundamentals.', 1),
(1, 'Variables and Data Types', 'video', 'video_python_variables.mp4', 2),
(1, 'Control Flow Quiz', 'mcq', '{"question": "What is the output of print(2 + 2)?", "options": ["2", "4", "22", "Error"], "answer": 1}', 3);

-- Insert sample course materials for Course 2 (Web Dev)
INSERT INTO course_materials (course_id, title, type, content_text, order_index) VALUES 
(2, 'Introduction to HTML', 'text', 'HTML is the foundation of all web pages. Learn to structure your content.', 1),
(2, 'CSS Styling Basics', 'video', 'video_css_basics.mp4', 2),
(2, 'JavaScript Fundamentals Quiz', 'mcq', '{"question": "Which keyword is used to declare a variable in modern JavaScript?", "options": ["var", "let", "const", "Both let and const"], "answer": 3}', 3);

-- Insert sample course materials for other courses
INSERT INTO course_materials (course_id, title, type, content_text, order_index) VALUES 
(3, 'What is Data Science?', 'text', 'Data Science combines statistics, programming, and domain expertise to extract insights from data.', 1),
(4, 'Mobile Development Overview', 'text', 'Learn the fundamentals of building mobile applications for iOS and Android.', 1),
(5, 'Introduction to AWS', 'text', 'Amazon Web Services (AWS) is the leading cloud platform. Learn to leverage its power.', 1);

-- =====================================================
-- BANK DATABASE
-- =====================================================
USE bank_db;

-- Bank accounts
CREATE TABLE accounts (
    account_number VARCHAR(50) PRIMARY KEY,
    secret VARCHAR(255) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction records
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    from_account VARCHAR(50) NOT NULL,
    to_account VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL,
    FOREIGN KEY (from_account) REFERENCES accounts(account_number),
    FOREIGN KEY (to_account) REFERENCES accounts(account_number)
);

-- Create LMS organization bank account with 50000 initial balance
INSERT INTO accounts (account_number, secret, balance) VALUES 
('LMS-ORG-001', '$2b$10$mH1JQjuiihKe9b27xb583u9uY0MGbbBshDcHLNj2ypZebTZjM.A4G', 50000.00);
