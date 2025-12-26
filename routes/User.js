// const express = require("express")
// const router = express.Router();

// const User = require("../modules/User");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const OTP = require("../modules/OTP");
// const { sendOTPEmail } = require("./emailService");

// router.post('/api/register',async(req,res)=>
//     {
//     try {
//         const {name ,email,phone,password}=req.body;
//         const exituser = await User.findOne({email})
//         if(exituser){
//             return res.status(400).json({message:"user already exist"})
//         }
//         const hashedPassword = await bcrypt.hash(password ,10)
//         const newuser =  new User({
//             name,
//             email,
//             phone,
//             password:hashedPassword
//         })

//         const saveduser = await newuser.save();
//         const token =jwt.sign({
//             userId:saveduser._id},"manishkumartokendata",{expiresIn:"7d"})
//             const userData = saveduser.toObject();
//       delete userData.password;

//       res.status(201).json({
//         status: true,
//         message: 'User registration successful',
//         user: userData,
//         token,
//       });

//     } catch (error) {
//         res.status(500).json({message:"server error "})
//     }
// })
// router.post('/api/login', async (req, res) => {
//     try {
//         const { email, phone, password } = req.body;
       
//         if (!email && !phone) {
//             return res.status(400).json({ message: "Please provide email or phone" });
//         }

//         const exituser = await User.findOne({
//             $or: [
//                 { email: email || null },
//                 { phone: phone || null }
//             ]
//         });
//         if (!exituser) {
//             return res.status(400).json({ message: "User does not exist" });
//         }

//         const isMatch = await bcrypt.compare(password, exituser.password);
//         if (!isMatch) {
//             return res.status(400).json({ message: "Invalid credentials" });
//         }      
//         const token = jwt.sign(
//             { userId: exituser._id },
//             "manishkumartokendata",
//             { expiresIn: "7d" }
//         );

//         const userData = exituser.toObject();
//         delete userData.password;

//         res.status(200).json({
//             status: true,
//             message: 'User login successful',
//             user: userData,
//             token
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });   
//     }
// });

// router.post("/api/auth/forgot-password-request-otp"  ,async(req,res)=>{
//     try {
//         const {email}= req.body;
//         if (!email) {
//           return res.status(400).json({message:"please provide email"})  
//         }
//         const user = await User.findOne({email});
//         if(!user){
//             return res.status(200).json({message:"if this email is registered ,an otp has been sent"})
//         }
//         const otp = Math.floor(1000+ Math.random()*9000)
//         //  const otp = Math.floor(1000 + Math.random() * 9000);
// await OTP.deleteMany({ email });
// const newOTP = new OTP({
//     email,
//     otp
// })
//  await newOTP.save();
// const emailSent= await sendOTPEmail(email,otp)
//   if (!emailSent) {
//             return res.status(500).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }
//            res.status(200).json({
//             status: "success",
//             message: "If this email is registered, an OTP has been sent"
//         });
//     } catch (error) {
//         res.status(500).json({message:"something went wrong"})
//     }
// })

// router.post('/api/auth/forgot-password-request-otp', async (req, res) => {
//     try {
//         const { email } = req.body;

//         // Validate input
//         if (!email) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email is required"
//             });
//         }

//         // Check if user exists
//         const user = await User.findOne({ email });

//         // Always return success message for security (don't reveal if email exists)
//         if (!user) {
//             return res.status(200).json({
//                 status: "success",
//                 message: "If this email is registered, an OTP has been sent"
//             });
//         }

//         // Generate 4-digit OTP
//         const otp = Math.floor(1000 + Math.random() * 9000);

//         // Delete any existing OTPs for this email
//         await OTP.deleteMany({ email });

//         // Save new OTP
//         const newOTP = new OTP({
//             email,
//             otp
//         });
//         await newOTP.save();

//         // Send OTP via email
//         const emailSent = await sendOTPEmail(email, otp);

//         if (!emailSent) {
//             return res.status(500).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }

//         res.status(200).json({
//             status: "success",
//             message: "If this email is registered, an OTP has been sent"
//         });

//     } catch (error) {
//         console.error("Forgot password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Something went wrong"
//         });
//     }
// });

// router.post('/api/auth/reset-password-with-otp', async (req, res) => {
//     try {
//         const { email, otp, newPassword } = req.body;

//         // Validate input
//         if (!email || !otp) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email and OTP are required"
//             });
//         }

//         // Find and verify OTP
//         const otpRecord = await OTP.findOne({ email, otp: Number(otp) });

//         if (!otpRecord) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Invalid or expired OTP"
//             });
//         }

//         // If newPassword provided, reset password
//         if (newPassword) {
//             // Validate password
//             if (newPassword.length < 6) {
//                 return res.status(400).json({
//                     status: "fail",
//                     message: "Password must be at least 6 characters"
//                 });
//             }

//             // Find user
//             const user = await User.findOne({ email });

//             if (!user) {
//                 return res.status(400).json({
//                     status: "fail",
//                     message: "User not found"
//                 });
//             }

//             // Hash new password
//             const hashedPassword = await bcrypt.hash(newPassword, 10);

//             // Update password
//             user.password = hashedPassword;
//             await user.save();

//             // Delete OTP after successful password reset
//             await OTP.deleteOne({ _id: otpRecord._id });

//             return res.status(200).json({
//                 status: "success",
//                 message: "Password reset successful"
//             });
//         }

//         // If no newPassword, just verify OTP
//         res.status(200).json({
//             status: "success",
//             message: "Otp verification successful"
//         });

//     } catch (error) {
//         console.error("Reset password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Invalid or expired OTP"
//         });
//     }
// });

// router.post('/api/auth/reset-password', async (req, res) => {
//     try {
//         const { email, newPassword } = req.body;

//         // Validate input
//         if (!email || !newPassword) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email and new password are required"
//             });
//         }

//         // Validate password
//         if (newPassword.length < 6) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Password must be at least 6 characters"
//             });
//         }

//         // Find user
//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }

//         // Hash new password
//         const hashedPassword = await bcrypt.hash(newPassword, 10);

//         // Update password
//         user.password = hashedPassword;
//         await user.save();

//         res.status(200).json({
//             status: "success",
//             message: "Password reset successful"
//         });

//     } catch (error) {
//         console.error("Reset password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Something went wrong"
//         });
//     }
// });



// router.get('/api',(req,res)=>{
//     res.send("user route work")
// })


// module.exports = router;
// const express = require("express")
// const router = express.Router();
// const User = require("../modules/User");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const OTP = require("../modules/OTP");
// const { sendOTPEmail } = require("./emailService");
// const authMiddleware = require('./authentication')



// const TokenBlacklist = require("../modules/TokenBlacklist");

// router.post('/api/auth/logout', authMiddleware, async (req, res) => {
//   try {
//     await TokenBlacklist.create({ token: req.token });

//     res.status(200).json({
//       status: true,
//       message: "Logout successful"
//     });
//   } catch (error) {
//     console.error("Logout error:", error);
//     res.status(500).json({
//       status: false,
//       message: "Logout failed"
//     });
//   }
// });
// router.delete('/api/auth/delete-account', authMiddleware, async (req, res) => {
//     try {
//         const userId = req.user.userId; 

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "User not found"
//             });
//         }

//         await User.findByIdAndDelete(userId);

//         res.status(200).json({
//             status: "success",
//             message: "Account deleted successfully"
//         });
//     } catch (error) {
//         console.error("Delete account error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Something went wrong"
//         });
//     }
// });

// router.post('/api/register',async(req,res)=>
//     {
//     try {
//         const {name ,email,phone,password}=req.body;
//         const exituser = await User.findOne({email})
//        { if(exituser){
//             return res.status(400).json({message:"user already exist"})
//         }}
//         const phonenum = await User.findOne({phone})

//          if(phonenum){
//             return res.status(400).json({message:"user already exist"})
//         }
           
//         const hashedPassword = await bcrypt.hash(password ,10)
//         const newuser =  new User({
//             name,
//             email,
//             phone,
//             password:hashedPassword
//         })

//         const saveduser = await newuser.save();
//         const token =jwt.sign({
//             userId:saveduser._id},"manishkumartokendata",{expiresIn:"7d"})
//             const userData = saveduser.toObject();
//       delete userData.password;

//       res.status(201).json({
//         status: true,
//         message: 'User registration successful',
//         user: userData,
//         token,
//       });

//     } catch (error) {
//         res.status(500).json({message:"server error "})
//     }
// })

// router.post('/api/login', async (req, res) => {
//     try {
//         const { email, phone, password } = req.body;
       
//         if (!email && !phone) {
//             return res.status(400).json({ message: "Please provide email or phone" });
//         }

//         const exituser = await User.findOne({
//             $or: [
//                 { email: email || null },
//                 { phone: phone || null }
//             ]
//         });
//         if (!exituser) {
//             return res.status(400).json({ message: "User does not exist" });
//         }

//         const isMatch = await bcrypt.compare(password, exituser.password);
//         if (!isMatch) {
//             return res.status(400).json({ message: "Invalid credentials" });
//         }      
//         const token = jwt.sign(
//             { userId: exituser._id },
//             "manishkumartokendata",
//             { expiresIn: "7d" }
//         );

//         const userData = exituser.toObject();
//         delete userData.password;

//         res.status(200).json({
//             status: true,
//             message: 'User login successful',
//             user: userData,
//             token
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });   
//     }
// });

// router.post("/api/auth/forgot-password-request-otp"  ,async(req,res)=>{
//     try {
//         const {email}= req.body;
//         if (!email) {
//           return res.status(400).json({message:"please provide email"})  
//         }
//         const user = await User.findOne({email});
//         if(!user){
//             return res.status(200).json({message:"if this email is registered ,an otp has been sent"})
//         }
//         const otp = Math.floor(1000+ Math.random()*9000)
        
// await OTP.deleteMany({ email });
// const newOTP = new OTP({
//     email,
//     otp
// })
//  await newOTP.save();
// const emailSent= await sendOTPEmail(email,otp)
//   if (!emailSent) {
//             return res.status(500).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }
//            res.status(200).json({
//             status: "success",
//             message: "If this email is registered, an OTP has been sent"
//         });
//     } catch (error) {
//         res.status(500).json({message:"something went wrong"})
//     }
// })

// router.post('/api/auth/forgot-password-request-otp', async (req, res) => {
//     try {
//         const { email } = req.body;

//         // Validate input
//         if (!email) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email is required"
//             });
//         }

//         // Check if user exists
//         const user = await User.findOne({ email });

//         // Always return success message for security (don't reveal if email exists)
//         if (!user) {
//             return res.status(200).json({
//                 status: "success",
//                 message: "If this email is registered, an OTP has been sent"
//             });
//         }

//         // Generate 4-digit OTP
//         const otp = Math.floor(1000 + Math.random() * 9000);

//         // Delete any existing OTPs for this email
//         await OTP.deleteMany({ email });

//         // Save new OTP
//         const newOTP = new OTP({
//             email,
//             otp
//         });
//         await newOTP.save();

//         // Send OTP via email
//         const emailSent = await sendOTPEmail(email, otp);

//         if (!emailSent) {
//             return res.status(500).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }

//         res.status(200).json({
//             status: "success",
//             message: "If this email is registered, an OTP has been sent"
//         });

//     } catch (error) {
//         console.error("Forgot password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Something went wrong"
//         });
//     }
// });

// router.post('/api/auth/reset-password-with-otp', async (req, res) => {
//     try {
//         const { email, otp, newPassword } = req.body;

//         // Validate input
//         if (!email || !otp) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email and OTP are required"
//             });
//         }

//         // Find and verify OTP
//         const otpRecord = await OTP.findOne({ email, otp: Number(otp) });

//         if (!otpRecord) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Invalid or expired OTP"
//             });
//         }

//         // If newPassword provided, reset password
//         if (newPassword) {
//             // Validate password
//             if (newPassword.length < 6) {
//                 return res.status(400).json({
//                     status: "fail",
//                     message: "Password must be at least 6 characters"
//                 });
//             }

//             // Find user
//             const user = await User.findOne({ email });

//             if (!user) {
//                 return res.status(400).json({
//                     status: "fail",
//                     message: "User not found"
//                 });
//             }

//             // Hash new password
//             const hashedPassword = await bcrypt.hash(newPassword, 10);

//             // Update password
//             user.password = hashedPassword;
//             await user.save();

//             // Delete OTP after successful password reset
//             await OTP.deleteOne({ _id: otpRecord._id });

//             return res.status(200).json({
//                 status: "success",
//                 message: "Password reset successful"
//             });
//         }

//         // If no newPassword, just verify OTP
//         res.status(200).json({
//             status: "success",
//             message: "Otp verification successful"
//         });

//     } catch (error) {
//         console.error("Reset password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Invalid or expired OTP"
//         });
//     }
// });

// router.post('/api/auth/reset-password', async (req, res) => {
//     try {
//         const { email, newPassword } = req.body;

//         // Validate input
//         if (!email || !newPassword) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Email and new password are required"
//             });
//         }

//         // Validate password
//         if (newPassword.length < 6) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Password must be at least 6 characters"
//             });
//         }

//         // Find user
//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.status(400).json({
//                 status: "fail",
//                 message: "Something went wrong"
//             });
//         }

//         // Hash new password
//         const hashedPassword = await bcrypt.hash(newPassword, 10);

//         // Update password
//         user.password = hashedPassword;
//         await user.save();

//         res.status(200).json({
//             status: "success",
//             message: "Password reset successful"
//         });

//     } catch (error) {
//         console.error("Reset password error:", error);
//         res.status(500).json({
//             status: "fail",
//             message: "Something went wrong"
//         });
//     }
// });

// router.get('/api',(req,res)=>{
//     res.send("user route work")
// })

// module.exports = router;
const express = require("express")
const router = express.Router();
const User = require("../modules/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const OTP = require("../modules/OTP");
const { sendOTPEmail } = require("./emailService");
const authMiddleware = require('./authentication')



const TokenBlacklist = require("../modules/TokenBlacklist");

router.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await TokenBlacklist.create({ token: req.token });

    res.status(200).json({
      status: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      status: false,
      message: "Logout failed"
    });
  }
});
router.delete('/api/auth/delete-account', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; 

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: "User not found"
            });
        }

        await User.findByIdAndDelete(userId);

        res.status(200).json({
            status: "success",
            message: "Account deleted successfully"
        });
    } catch (error) {
        console.error("Delete account error:", error);
        res.status(500).json({
            status: "fail",
            message: "Something went wrong"
        });
    }
});

router.post('/api/register',async(req,res)=>
    {
    try {
        const {name ,email,phone,password}=req.body;
        const exituser = await User.findOne({email})
       { if(exituser){
            return res.status(400).json({message:"user already exist"})
        }}
        const phonenum = await User.findOne({phone})

         if(phonenum){
            return res.status(400).json({message:"user already exist"})
        }
           
        const hashedPassword = await bcrypt.hash(password ,10)
        const newuser =  new User({
            name,
            email,
            phone,
            password:hashedPassword
        })

        const saveduser = await newuser.save();
        const token =jwt.sign({
            userId:saveduser._id},"manishkumartokendata",{expiresIn:"7d"})
            const userData = saveduser.toObject();
      delete userData.password;

      res.status(201).json({
        status: true,
        message: 'User registration successful',
        user: userData,
        token,
      });

    } catch (error) {
        res.status(500).json({message:"server error "})
    }
})

router.post('/api/login', async (req, res) => {
    try {
        const { email, phone, password } = req.body;
       
        if (!email && !phone) {
            return res.status(400).json({ message: "Please provide email or phone" });
        }

        const exituser = await User.findOne({
            $or: [
                { email: email || null },
                { phone: phone || null }
            ]
        });
        if (!exituser) {
            return res.status(400).json({ message: "User does not exist" });
        }

        const isMatch = await bcrypt.compare(password, exituser.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }      
        const token = jwt.sign(
            { userId: exituser._id },
            "manishkumartokendata",
            { expiresIn: "7d" }
        );

        const userData = exituser.toObject();
        delete userData.password;

        res.status(200).json({
            status: true,
            message: 'User login successful',
            user: userData,
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });   
    }
});

router.post("/api/auth/forgot-password-request-otp"  ,async(req,res)=>{
    try {
        const {email}= req.body;
        if (!email) {
          return res.status(400).json({message:"please provide email"})  
        }
        const user = await User.findOne({email});
        if(!user){
            return res.status(200).json({message:"if this email is registered ,an otp has been sent"})
        }
        const otp = Math.floor(1000+ Math.random()*9000)
        
await OTP.deleteMany({ email });
const newOTP = new OTP({
    email,
    otp
})
 await newOTP.save();
const emailSent= await sendOTPEmail(email,otp)
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
        res.status(500).json({message:"something went wrong"})
    }
})

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

router.get('/api',(req,res)=>{
    res.send("user route work")
})

module.exports = router;






