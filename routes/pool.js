const express = require("express");
const router = express.Router();
const auth = require("./authentication");
const Pool = require("../modules/pool");
const User = require("../modules/User");
const generateSlug = require('../utils/generateSlug');

router.post("/create", auth, async (req, res) => {
  try {
    const user = req.user; 
    const data = req.body;

    if (!user || !user._id) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: user not found"
      });
    }

    if (user.totalPoints < data.pointsToAward) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient points to create pool"
      });
    }

    let participants = [];

    // Handle friends invite
    if (data.friends?.length) {
      const emails = data.friends
        .map(f => f.email)
        .filter(Boolean);

      const phones = data.friends
        .map(f => f.phone)
        .filter(p => /^\d+$/.test(p))
        .map(p => Number(p));

      // Find registered users
      const registeredUsers = await User.find({
        $or: [
          { email: { $in: emails } },
          { phone: { $in: phones } }
        ]
      });

      // Registered friends → pending
      registeredUsers.forEach(u => {
        participants.push({
          userId: u._id,
          email: u.email,
          phone: u.phone,
          name: u.name,
          status: "pending"
        });
      });

      // Unregistered friends → pending
      data.friends.forEach(f => {
        const exists = registeredUsers.find(
          u => u.email === f.email || u.phone === Number(f.phone)
        );
        if (!exists) {
          participants.push({
            email: f.email,
            phone: f.phone ? Number(f.phone) : undefined,
            name: f.name,
            status: "pending"
          });
        }
      });
    }

    // Creator auto-participant
    participants.push({
      userId: user._id,
      name: user.name,
      status: "accepted"
    });

    delete data.createdBy;

    // Create pool
    const pool = await Pool.create({
      ...data,
      participants,
      slug: generateSlug(),
      createdBy: user._id
    });

    // Deduct points
    user.totalPoints -= data.pointsToAward;
    await user.save();

    // ✅ Count only accepted participants
    const acceptedCount = participants.filter(p => p.status === "accepted").length;

    // Response in desired format
    res.status(201).json({
      status: "success",
      message: "Pool created successfully",
      pool: {
        id: pool._id,
        poolName: pool.poolName,
        category: pool.category,
        pointsToAward: pool.pointsToAward,
        createdBy: {
          id: user._id,
          name: user.name
        },
        participantsCount: acceptedCount  // ✅ Only accepted count
      }
    });

  } catch (err) {
    res.status(500).json({ 
      status: "error", 
      message: err.message 
    });
  }
});

module.exports = router;
