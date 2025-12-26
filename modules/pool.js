// const mongoose = require('mongoose');

// const poolSchema = new mongoose.Schema({
//   poolName: String,
//   description: String,
//   category: String,
//   question: String,
//   options: [String],
//   pointsToAward: Number,
//   winningCriteria: String,
//   customRules: String,
//   rewardSystem: {
//     type: String,
//     // enum: ['Points Awards', 'Podium']
//   },
//   winner: {
//     type: Number,
//     // min: 0,
//     // max: 100
//   },
//   runnerUp: {
//     type: Number,
//     // min: 0,
//     // max: 100
//   },
//   secondRunnerUp: {
//     type: Number,
//     // min: 0,
//     // max: 100
//   },
//   friends: [
//     {
//       email: { type: String},
//       phone: { type: String},
//       name: { type: String}
//     }
//   ]

// }, { timestamps: true });

// module.exports = mongoose.model('Pool', poolSchema);
const mongoose = require("mongoose");

const poolSchema = new mongoose.Schema({
  poolName: { type: String, required: true },
  description: String,
  category: String,

  question: { type: String, required: true },
  options: { type: [String], required: true },

  pointsToAward: { type: Number, required: true },
  winningCriteria: String,
  customRules: String,

  rewardSystem: String,
  winner: Number,
  runnerUp: Number,
  secondRunnerUp: Number,


  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      email: String,
      phone: String,
      name: String,
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending"
      }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slug: { type: String, unique: true, required: true }

}, { timestamps: true });

module.exports = mongoose.model("Pool", poolSchema);
