// const express = require("express");
// const connectDB= require('./db')
// const app = express();
// require('dotenv').config();
// const cors = require('cors')
// const user = require ("./routes/User")
// app.use(express.json());
// app.use(cors())
// connectDB();
// app.use('/',user)
// app.get('/',(req,res)=>{
//     res.send("welcome to Porralia Batting App")
// })

// console.log('SendGrid API Key:', process.env.SENDGRID_API_KEY ? 'Set' : 'NOT SET');
// console.log('SendGrid From Email:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');

// const PORT = process.env.PORT||5000;
// app.listen(PORT,()=>{
//     console.log(` server running on port ${PORT}`)
// })


const express = require("express");
const connectDB= require('./db')
const app = express();
require('dotenv').config();
const cors = require('cors')
const user = require ("./routes/User");
const router = require("./routes/pool");
const authMiddleware = require('./routes/authentication')


require("./modules/monthlyReward");

app.use(express.json());
app.use(cors())
connectDB();
app.use('/',user)
app.use("/",router)
app.get('/',(req,res)=>{
    res.send("welcome to Porralia Batting App")
})

console.log('SendGrid API Key:', process.env.SENDGRID_API_KEY ? 'Set' : 'NOT SET');
console.log('SendGrid From Email:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');

const PORT = process.env.PORT||5000;
// app.listen(PORT,()=>{
//     console.log(` server running on port ${PORT}`)
// })

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
