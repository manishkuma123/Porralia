
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
    phone: {
        type: Number,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },

    // total points
    totalPoints: {
        type: Number,
        default: 100
    },

    // notification on/off
    notificationStatus: {
        type: String,
        enum: ["on", "off"],
        default: "on"
    },

    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastRewardAt: {
        type: Date,
        default: Date.now
    },

  profile: {
    url: { type: String },
    public_id: { type: String } 
  },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);

