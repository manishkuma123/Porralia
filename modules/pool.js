const mongoose = require("mongoose");

const poolSchema = new mongoose.Schema({
  poolName: { type: String, required: true },
  description: String,
  category: String,

  question: { type: String, required: true },
  options: { type: [String], required: true },

  pointsToJoin: { type: Number, required: true },
  winningCriteria: String,
  customRules: String,

  rewardSystem: {
    type: String,
    enum: ["Points Awards", "Podium"]
  },
 
  winner: Number,
  runnerUp: Number,
  secondRunnerUp: Number,


  correctPrediction: { type: String, default: null },
  resultDeclaredAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active"
  },

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
},

      joinedAt: {
        type: Date,
        default: Date.now  
      },
      score: { type: Number, default: 0 },
      pointsEarned: { type: Number, default: 0 },
      
      
      prediction: { type: String, default: null },
      predictionSubmittedAt: { type: Date, default: null },
      
   
      resultStatus: {
        type: String,
        enum: ["won", "lost", null],
        default: null
      },
      
      
      rank: { type: Number, default: null }
    }
  ],


  leaderboard: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      totalPoints: { type: Number, default: 0 },
      rank: Number,
      rewardAmount: Number,
      rewardSystem: String,
      joinedAt: Date,
      predictionSubmittedAt: Date
    }
  ],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slug: { type: String, unique: true, required: true },
  

  inviteLink: { type: String, default: null }

}, { timestamps: true });

module.exports = mongoose.model("Pool", poolSchema);
