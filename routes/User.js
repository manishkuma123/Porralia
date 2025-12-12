const express = require("express")
const router = express.Router();

const User = require("../modules/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


router.post('/api/register',async(req,res)=>
    {
    try {
        const {name ,email,phone,password}=req.body;
        const exituser = await User.findOne({email})
        if(exituser){
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


router.post('/api/sendmail',(req,res)=>{
    try {
        

    } catch (error) {
        res.status(500).json({message:"server error"})
    }
})



router.get('/api',(req,res)=>{
    res.send("user route work")
})


module.exports = router;

