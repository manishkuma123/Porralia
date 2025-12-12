const express = require("express");
const connectDB= require('./db')
const app = express();
require('dotenv').config();
const cors = require('cors')
const user = require ("./routes/User")
app.use(express.json());
app.use(cors())
connectDB();
app.use('/',user)
app.get('/',(req,res)=>{
    res.send("welcome to Porralia Batting App")
})

const PORT = process.env.PORT||5000;
app.listen(PORT,()=>{
    console.log(` server running on port ${PORT}`)
})