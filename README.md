# LMS Platform

A comprehensive Learning Management System with integrated banking functionality built with Node.js, Express, MySQL, and EJS.

## Features

- **Role-Based Access**: Learner, Instructor, and Admin portals
- **Bank Integration**: Separate microservice for banking operations
- **Course Management**: Upload, purchase, and learn courses
- **Payment Flow**: 70% instructor commission, 30% LMS revenue
- **Certificates**: Auto-generated upon course completion
- **Material Types**: Support for text, video, audio, and MCQ

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MySQL
- **Views**: EJS templates
- **Styling**: Tailwind CSS (CDN)
- **Authentication**: Express-session with bcrypt

## Installation

1. **Install dependencies**:
```bash
# Bank API
cd bank-api
npm install

# LMS API
cd ../lms-api
npm install
```

2. **Setup database**:
```bash
mysql -u root -proot < database/schema.sql
```

3. **Start Bank API** (port 4000):
```bash
cd bank-api
npm start
```

4. **Start LMS API** (port 3000):
```bash
cd lms-api
npm start
```

5. **Access the application**:
   - Open http://localhost:3000
   - Register as learner or instructor
   - Default admin login: admin@lms.com / admin123

## Payment Flow

1. **Learner Purchase**: Learner pays course price → LMS organization account
2. **Instructor Commission**: LMS creates transaction record for 70% → Instructor
3. **Upload Bonus**: Instructors receive $500 for each course upload
4. **Initial Balances**: Learners start with $1000, LMS org starts with $50,000

## Project Structure

```
lms2/
├── bank-api/          # Banking microservice (port 4000)
├── lms-api/           # Main LMS application (port 3000)
│   ├── controllers/   # Business logic
│   ├── routes/        # API routes
│   ├── views/         # EJS templates
│   ├── middleware/    # Auth middleware
│   └── public/        # Static files
└── database/          # SQL schema
```

## Default Credentials

- **Admin**: admin@lms.com / admin123
- **Instructor**: instructor1@lms.com / instructor123
- Create learner accounts via registration

## Features by Role

### Learner
- Browse and purchase courses
- Access course materials
- Complete courses and earn certificates
- Bank account with $1000 initial balance
- Check balance

### Instructor
- Upload courses with materials
- Earn $500 upload bonus
- Receive 70% commission on sales
- View student enrollments
- Check earnings

### Admin
- View system statistics
- Monitor all courses and users
- Track LMS organization balance
- View recent enrollments
# lms
