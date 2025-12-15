// ============================================
// FILE: modules/User.js
// ============================================
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);


// ============================================
// FILE: modules/OTP.js
// ============================================
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // OTP expires after 10 minutes (600 seconds)
    }
});

module.exports = mongoose.model("OTP", otpSchema);


// ============================================
// FILE: services/emailService.js
// ============================================
const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send OTP email
const sendOTPEmail = async (email, otp) => {
    try {
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            You have requested to reset your password.
                        </p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 30px 0;">
                            <p style="color: #666; margin: 0 0 10px 0;">Your OTP is:</p>
                            <p style="font-size: 32px; font-weight: bold; color: #007bff; margin: 0; letter-spacing: 5px;">
                                ${otp}
                            </p>
                        </div>
                        <p style="color: #666; font-size: 14px;">
                            ⏰ This OTP will expire in <strong>10 minutes</strong>.
                        </p>
                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            If you didn't request this, please ignore this email or contact support if you have concerns.
                        </p>
                    </div>
                </div>
            `,
            text: `Password Reset Request\n\nYour OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
        };

        await sgMail.send(msg);
        console.log('OTP email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending email via SendGrid:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return false;
    }
};

module.exports = { sendOTPEmail };


// ============================================
// FILE: routes/auth.js
// ============================================
const express = require("express");
const router = express.Router();
const User = require("../modules/User");
const OTP = require("../modules/OTP");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOTPEmail } = require("../services/emailService");


router.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Validate input
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                status: false,
                message: "All fields are required"
            });
        }

        // Check if user already exists
        const exituser = await User.findOne({ email });
        if (exituser) {
            return res.status(400).json({
                status: false,
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newuser = new User({
            name,
            email,
            phone,
            password: hashedPassword
        });

        const saveduser = await newuser.save();

        // Generate token
        const token = jwt.sign(
            { userId: saveduser._id },
            process.env.JWT_SECRET || "manishkumartokendata",
            { expiresIn: "7d" }
        );

        // Remove password from response
        const userData = saveduser.toObject();
        delete userData.password;

        res.status(201).json({
            status: true,
            message: 'User registration successful',
            user: userData,
            token
        });

    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            status: false,
            message: "Server error"
        });
    }
});


router.post('/api/auth/login', async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        // Validate input
        if (!email && !phone) {
            return res.status(400).json({
                status: false,
                message: "Please provide email or phone"
            });
        }

        if (!password) {
            return res.status(400).json({
                status: false,
                message: "Password is required"
            });
        }

        // Find user by email or phone
        const exituser = await User.findOne({
            $or: [
                { email: email || null },
                { phone: phone || null }
            ]
        });

        if (!exituser) {
            return res.status(400).json({
                status: false,
                message: "User does not exist"
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, exituser.password);
        if (!isMatch) {
            return res.status(400).json({
                status: false,
                message: "Invalid credentials"
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: exituser._id },
            process.env.JWT_SECRET || "manishkumartokendata",
            { expiresIn: "7d" }
        );

        // Remove password from response
        const userData = exituser.toObject();
        delete userData.password;

        res.status(200).json({
            status: true,
            message: 'User login successful',
            user: userData,
            token
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            status: false,
            message: "Server error"
        });
    }
});

router.post('/api/auth/forgot-password-request-otp', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({
                status: "fail",
                message: "Email is required"
            });
        }

        // Check if user exists
        const user = await User.findOne({ email });

        // Always return success message for security (don't reveal if email exists)
        if (!user) {
            return res.status(200).json({
                status: "success",
                message: "If this email is registered, an OTP has been sent"
            });
        }

        // Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000);

        // Delete any existing OTPs for this email
        await OTP.deleteMany({ email });

        // Save new OTP
        const newOTP = new OTP({
            email,
            otp
        });
        await newOTP.save();

        // Send OTP via email
        const emailSent = await sendOTPEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({
                status: "fail",
                message: "Something went wrong"
            });
        }

        res.status(200).json({
            status: "success",
            message: "If this email is registered, an OTP has been sent"
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
});

router.post('/api/auth/reset-password-with-otp', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate input
        if (!email || !otp) {
            return res.status(400).json({
                status: "fail",
                message: "Email and OTP are required"
            });
        }

        // Find and verify OTP
        const otpRecord = await OTP.findOne({ email, otp: Number(otp) });

        if (!otpRecord) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid or expired OTP"
            });
        }

        // If newPassword provided, reset password
        if (newPassword) {
            // Validate password
            if (newPassword.length < 6) {
                return res.status(400).json({
                    status: "fail",
                    message: "Password must be at least 6 characters"
                });
            }

            // Find user
            const user = await User.findOne({ email });

            if (!user) {
                return res.status(400).json({
                    status: "fail",
                    message: "User not found"
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            user.password = hashedPassword;
            await user.save();

            // Delete OTP after successful password reset
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(200).json({
                status: "success",
                message: "Password reset successful"
            });
        }

        // If no newPassword, just verify OTP
        res.status(200).json({
            status: "success",
            message: "Otp verification successful"
        });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            status: "fail",
            message: "Invalid or expired OTP"
        });
    }
});

router.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Validate input
        if (!email || !newPassword) {
            return res.status(400).json({
                status: "fail",
                message: "Email and new password are required"
            });
        }

        // Validate password
        if (newPassword.length < 6) {
            return res.status(400).json({
                status: "fail",
                message: "Password must be at least 6 characters"
            });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                status: "fail",
                message: "Something went wrong"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            status: "success",
            message: "Password reset successful"
        });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
});

module.exports = router;


// ============================================
// FILE: .env
// ============================================
/*
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

MONGODB_URI=mongodb://localhost:27017/your-database
JWT_SECRET=manishkumartokendata
PORT=5000
*/


// ============================================
// FILE: server.js (Main Server File)
// ============================================
/*
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
app.use(authRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
*/


// ============================================
// FILE: package.json (Dependencies)
// ============================================
/*
{
  "name": "password-reset-api",
  "version": "1.0.0",
  "description": "Password reset with OTP using SendGrid",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "@sendgrid/mail": "^7.7.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
*/