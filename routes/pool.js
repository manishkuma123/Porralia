const express = require("express");
const router = express.Router();
const auth = require("./authentication");
const Pool = require("../modules/pool");
const User = require("../modules/User");
const generateSlug = require('../utils/generateSlug');
const icon = require('../modules/category')
const { sendInAppNotification } = require("../utils/notification");
const Notification = require("../modules/notification");
const Category = require("../modules/category");
const InviteLink = require("../modules/InviteLink");
const generateInviteToken = require("../utils/generateInviteToken");
const { v4: uuidv4 } = require("uuid");

router.post("/pool/create", auth, async (req, res) => {
  try {
    const user = req.user;
    const data = req.body;

    if (!user || !user._id) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: user not found"
      });
    }

    if (user.totalPoints < data.pointsToJoin) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient points to create pool"
      });
    }

    // 🔹 Category name
    let categoryName = null;
    if (data.category) {
      const category = await Category.findById(data.category);
      if (category) categoryName = category.name;
    }

    let participants = [];

    // 🔹 Invite friends
    if (data.friends?.length) {
      const emails = data.friends.map(f => f.email).filter(Boolean);
      const phones = data.friends
        .map(f => f.phone)
        .filter(p => /^\d+$/.test(p))
        .map(Number);

      const registeredUsers = await User.find({
        $or: [{ email: { $in: emails } }, { phone: { $in: phones } }]
      });

      registeredUsers.forEach(u => {
        participants.push({
          userId: u._id,
          email: u.email,
          phone: u.phone,
          name: u.name,
          status: "pending"
        });
      });

      // Unregistered users (only email/phone)
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

    // 🔹 Creator auto-accepted
    participants.push({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      status: "accepted"
    });

    delete data.createdBy;

    // 🔹 Create Pool
    const pool = await Pool.create({
      ...data,
      participants,
      slug: generateSlug(),
      createdBy: user._id
    });

    // 🔹 Deduct points
    user.totalPoints -= data.pointsToJoin;
    
    await user.save();

    // 🔹 Send notifications
    const pendingRegisteredUsers = participants.filter(
      p => p.status === "pending" && p.userId
    );

    for (const participant of pendingRegisteredUsers) {
      await sendInAppNotification(participant.userId, {
        type: "pool_invitation",
        title: "Pool Invitation",
        message: `${user.name} invited you to join "${pool.poolName}"`,
        data: {
          poolId: pool._id,
          inviterId: user._id
        }
      });
    }

    // 🔑 INVITE LINK GENERATION (NEW)
    const inviteToken = uuidv4();

    await InviteLink.create({
      poolId: pool._id,
      inviterId: user._id,
      token: inviteToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
   let name = "https://jsmastery.com"
    const inviteLink = `${name}/invite?token=${inviteToken}`;
pool.inviteLink = inviteLink;
await pool.save();
    const acceptedCount = participants.filter(p => p.status === "accepted").length;

    res.status(201).json({
      status: "success",
      message: "Pool created successfully",
      pool: {
        id: pool._id,
        poolName: pool.poolName,
        category: pool.category,
        categoryName,
        pointsToJoin: pool.pointsToJoin,
        inviteLink,
        createdBy: {
          id: user._id,
          name: user.name
        },
        participantsCount: acceptedCount
      }
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.put("/pool/:poolId", auth, async (req, res) => {
  try {
    const user = req.user;
    const { poolId } = req.params;
    const { question, options } = req.body;

    if (!user || !user._id) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
    }

    const pool = await Pool.findById(poolId);

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    // 🔒 Only creator can update
    if (pool.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You are not allowed to update this pool"
      });
    }

    // ❌ Block empty updates
    if (!question && !options) {
      return res.status(400).json({
        status: "error",
        message: "Nothing to update"
      });
    }

    // ✅ Update question
    if (question) {
      pool.question = question;
    }

    // ✅ Update options
    if (options) {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          status: "error",
          message: "Options must be an array with at least 2 values"
        });
      }
      pool.options = options;
    }

    await pool.save();

    res.status(200).json({
      status: "success",
      message: "Question and options updated successfully",
      pool: {
        id: pool._id,
        question: pool.question,
        options: pool.options
      }
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/pool/list", auth, async (req, res) => {
  try {
    const userId = req.user?._id;
    const pools = await Pool.find({
      $or: [
        { createdBy: userId },
        {
          participants: {
            $elemMatch: {
              userId: userId,
              status: "accepted"
            }
          }
        }
      ]
    })
      .populate("createdBy", "name")
      .populate("participants.userId", "name profile createdAt")
      // .populate("leaderboard.userId", "name profile") // ✅ ADD THIS
      .populate("leaderboard.userId", "name profile totalPoints") 
      .sort({ createdAt: -1 });

    // Category handling
    const categoryIds = [];
    const categoryNames = [];

    pools.forEach(pool => {
      if (pool.category) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
        if (isObjectId) {
          categoryIds.push(pool.category);
        } else {
          categoryNames.push(pool.category);
        }
      }
    });

    const categories = await Category.find({
      $or: [
        { _id: { $in: [...new Set(categoryIds)] } },
        { name: { $in: [...new Set(categoryNames)] } }
      ]
    });
    
    const categoryMapById = {};
    const categoryMapByName = {};
    
    categories.forEach(cat => {
      const categoryData = {
        id: cat._id,
        name: cat.name,
        icon: cat.icon
      };
      categoryMapById[cat._id.toString()] = categoryData;
      categoryMapByName[cat.name] = categoryData;
    });

    // Invite links
    const poolIds = pools.map(p => p._id);
    const inviteLinks = await InviteLink.find({ 
      poolId: { $in: poolIds } 
    });
    
    const inviteLinkMap = {};
    inviteLinks.forEach(link => {
      inviteLinkMap[link.poolId.toString()] = `https://jsmastery.com/invite?token=${link.token}`;
    });

    const formattedPools = pools.map(pool => {
      const acceptedParticipants = pool.participants.filter(
        p => p.status === "accepted"
      );

      const currentUserParticipant = pool.participants.find(
        p => p.userId && p.userId._id.toString() === userId.toString()
      );

      let categoryDetails = null;
      if (pool.category) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
        if (isObjectId) {
          categoryDetails = categoryMapById[pool.category.toString()];
        } else {
          categoryDetails = categoryMapByName[pool.category];
        }
      }

      let resultInfo = null;
      if (pool.status === "completed" && pool.correctPrediction) {
        resultInfo = {
          correctPrediction: pool.correctPrediction,
          userPointsEarned: currentUserParticipant?.pointsEarned || 0,
          userResult: currentUserParticipant?.resultStatus || null,
        };
      }

      // ✅ LEADERBOARD WITH WINNER DATA
      // Leaderboard will only have data when pool is completed and result is declared
      // It contains only WINNERS (participants who predicted correctly)
      const leaderboard = (pool.leaderboard || []).map((l, index) => ({
        rank: l.rank || index + 1,
                   _id: l._id,
        playerAvatar: l.userId?.profile || null, 
        playerName: l.userId?.name || l.name || "Unknown",
        rewardSystem: l.rewardSystem || pool.rewardSystem || "Points",
        rewardAmount: l.rewardAmount || l.totalPoints || 0,
        // totalPoints: l.totalPoints || 0,
         totalPoints: l.userId?.totalPoints,
          // totalPoints: l.totalPoints || l.rewardAmount || 0, //
  // userTotalPoints: l.userId?.totalPoints || 0,
        joinedAt: l.joinedAt ? new Date(l.joinedAt).toDateString() : null,
        predictionSubmittedAt: l.predictionSubmittedAt ? new Date(l.predictionSubmittedAt).toDateString() : null
      }));
      
      return {
        id: pool._id,
        category: categoryDetails || null, 
        poolStatus: pool.status || "Live",
        rewardSystem: pool.rewardSystem,
        inviteLink: inviteLinkMap[pool._id.toString()] || pool.inviteLink || null,
        title: pool.poolName,
        description: pool.description || "",
        players: acceptedParticipants.length,
        yourPrediction: currentUserParticipant?.prediction || null,
        predictionSubmittedAt: currentUserParticipant?.predictionSubmittedAt || null,
        result: resultInfo,
        participants: acceptedParticipants.map(p => ({
          //  _id: p._id,
          // 
        
          // 
          playerAvatar: p.userId?.profile || null,
          playerName: p.userId?.name || p.name,
          playerJoinedDate: p.joinedAt
            ? new Date(p.joinedAt).toDateString()
            : null
        })),

        betAmount: pool.pointsToJoin,
        totalPot: pool.pointsToJoin * acceptedParticipants.length, 
        maxWin: pool.maxWin || pool.pointsToJoin,
        pointsScored: pool.pointsScored || 0,
        options: pool.options || [],
        leaderboard: leaderboard,
        createdBy: {
          id: pool.createdBy?._id,
          name: pool.createdBy?.name
        }
      };
    });

    res.status(200).json({
      status: "success",
      message: "Pools fetched successfully",
      data: formattedPools
    }); 

  } catch (err) {
    console.error("Error fetching pools:", err);
    res.status(500).json({
      status: "fail",
      message: "Unable to fetch pools",
      error: err.message
    });
  }
});

router.post("/pool/:poolId/prediction", auth, async (req, res) => {
  try {

    const userId = req.user._id;
    const { poolId } = req.params;
    const { prediction } = req.body;

    
    if (!prediction) {
      return res.status(400).json({
        status: "error",
        message: "Prediction is required"
      });
    }

    
    const pool = await Pool.findById(poolId).populate("participants.userId", "name email");

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    if (pool.status === "completed") {
      return res.status(400).json({
        status: "error",
        message: "This pool has already been completed. No more predictions allowed."
      });
    }

    if (pool.status === "cancelled") {
      return res.status(400).json({
        status: "error",
        message: "This pool has been cancelled."
      });
    }

    
    const participantIndex = pool.participants.findIndex(
      p => p.userId && p.userId._id.toString() === userId.toString()
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        status: "error",
        message: "You are not a participant in this pool"
      });
    }

    const participant = pool.participants[participantIndex];

    
    if (participant.status !== "accepted") {
      return res.status(403).json({
        status: "error",
        message: `Your participation status is "${participant.status}". Only accepted participants can submit predictions.`
      });
    }

 
    if (participant.prediction) {
      return res.status(400).json({
        status: "error",
        message: "You have already submitted a prediction for this pool",
        data: {
          yourPrediction: participant.prediction,
          submittedAt: participant.predictionSubmittedAt
        }
      });
    }


    if (!pool.options || !pool.options.includes(prediction)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid prediction. Must be one of the available options",
        availableOptions: pool.options || []
      });
    }

    
    pool.participants[participantIndex].prediction = prediction;
    pool.participants[participantIndex].predictionSubmittedAt = new Date();

    await pool.save();

    // Count total predictions submitted
    const totalPredictions = pool.participants.filter(p => p.prediction).length;
    const totalParticipants = pool.participants.filter(p => p.status === "accepted").length;

    res.status(200).json({
      status: "success",
      message: "Your prediction has been recorded successfully",
      data: {
        poolId: pool._id,
        poolName: pool.poolName,
        question: pool.question,
        yourPrediction: prediction,
        submittedAt: pool.participants[participantIndex].predictionSubmittedAt,
        totalPredictions: totalPredictions,
        totalParticipants: totalParticipants
      }
    });

  } catch (err) {
    console.error("Prediction submission error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.post("/pool/:poolId/declare-result", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { poolId } = req.params;
    const { correctPrediction } = req.body;

  
    if (!correctPrediction) {
      return res.status(400).json({
        status: "error",
        message: "correctPrediction is required"
      });
    }

    // Find pool and populate participants
    const pool = await Pool.findById(poolId).populate("participants.userId", "name email avatar");

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    // Check if user is pool creator
    const isCreator = pool.createdBy.toString() === userId.toString();

    if (!isCreator) {
      return res.status(403).json({
        status: "error",
        message: "Only the pool creator can declare results"
      });
    }

    // Check if result already declared
    if (pool.correctPrediction) {
      return res.status(400).json({
        status: "error",
        message: "Result has already been declared for this pool",
        data: {
          correctPrediction: pool.correctPrediction,
          declaredAt: pool.resultDeclaredAt
        }
      });
    }

    // Validate correct prediction is one of the options
    if (!pool.options || !pool.options.includes(correctPrediction)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid correct prediction. Must be one of the available options",
        availableOptions: pool.options || []
      });
    }

    // Set correct prediction
    pool.correctPrediction = correctPrediction;
    pool.resultDeclaredAt = new Date();
    pool.status = "completed";

    // Calculate results for all participants
    const winners = [];
    const losers = [];

    pool.participants.forEach(participant => {
      // Only count accepted participants who submitted predictions
      if (participant.status === "accepted" && participant.prediction) {
        if (participant.prediction === correctPrediction) {
          participant.resultStatus = "won";
          winners.push(participant);
        } else {
          participant.resultStatus = "lost";
          losers.push(participant);
        }
      }
    });

    // Calculate total pot (all accepted participants' entry fees)
    const acceptedParticipants = pool.participants.filter(p => p.status === "accepted");
    const totalPot = pool.pointsToJoin * acceptedParticipants.length;

    // Distribute rewards based on reward system
    if (pool.rewardSystem === "Points Awards") {
      // Equal distribution of TOTAL POT among all winners
      const totalWinners = winners.length;
      
      if (totalWinners > 0) {
        const pointsPerWinner = Math.floor(totalPot / totalWinners);
        
        for (const winner of winners) {
          winner.pointsEarned = pointsPerWinner;
          winner.score = pointsPerWinner;
          
          // Update user total points
          if (winner.userId) {
            await User.findByIdAndUpdate(winner.userId._id, {
              $inc: { totalPoints: pointsPerWinner }
            });
          }
        }
      }

    } else if (pool.rewardSystem === "Podium") {
      // Podium system: Top 3 winners based on submission time
      if (winners.length > 0) {
        // Sort winners by prediction submission time (earliest first)
        winners.sort((a, b) => 
          new Date(a.predictionSubmittedAt) - new Date(b.predictionSubmittedAt)
        );

        // Assign 1st place
        if (winners[0]) {
          winners[0].pointsEarned = pool.winner || 0;
          winners[0].rank = 1;
          if (winners[0].userId) {
            await User.findByIdAndUpdate(winners[0].userId._id, {
              $inc: { totalPoints: winners[0].pointsEarned }
            });
          }
        }
        
        // Assign 2nd place
        if (winners[1]) {
          winners[1].pointsEarned = pool.runnerUp || 0;
          winners[1].rank = 2;
          if (winners[1].userId) {
            await User.findByIdAndUpdate(winners[1].userId._id, {
              $inc: { totalPoints: winners[1].pointsEarned }
            });
          }
        }
        
        // Assign 3rd place
        if (winners[2]) {
          winners[2].pointsEarned = pool.secondRunnerUp || 0;
          winners[2].rank = 3;
          if (winners[2].userId) {
            await User.findByIdAndUpdate(winners[2].userId._id, {
              $inc: { totalPoints: winners[2].pointsEarned }
            });
          }
        }

        // Remaining winners get 0 points but still marked as won
        for (let i = 3; i < winners.length; i++) {
          winners[i].pointsEarned = 0;
          winners[i].rank = i + 1;
        }
      }
    }

    // Build leaderboard (all winners sorted by rank/points)
    pool.leaderboard = winners.map((winner, index) => ({
      userId: winner.userId?._id,
      name: winner.userId?.name || winner.name,
      totalPoints: winner.pointsEarned || 0,
      rank: winner.rank || index + 1,
      rewardAmount: winner.pointsEarned || 0,
      rewardSystem: pool.rewardSystem,
      joinedAt: winner.joinedAt,
      predictionSubmittedAt: winner.predictionSubmittedAt
    }));

    // Send notifications to all participants
    for (const p of pool.participants) {
      if (p.userId && p.status === "accepted" && p.prediction) {
        const isWinner = p.resultStatus === "won";
        
        await sendInAppNotification(p.userId._id, {
          type: isWinner ? "pool_won" : "pool_lost",
          title: isWinner ? "Congratulations! 🎉" : "Pool Result Declared",
          message: isWinner 
            ? `You won ${p.pointsEarned || 0} points in "${pool.poolName}"! Your prediction was correct.`
            : `Results for "${pool.poolName}" are out. The correct answer was "${correctPrediction}". Better luck next time!`,
          data: {
            poolId: pool._id,
            poolName: pool.poolName,
            resultStatus: p.resultStatus,
            pointsEarned: p.pointsEarned || 0,
            correctPrediction: correctPrediction,
            userPrediction: p.prediction,
            rank: p.rank || null
          }
        });
      }
    }

    await pool.save();

    res.status(200).json({
      status: "success",
      message: "Result declared successfully",
      data: {
        poolId: pool._id,
        poolName: pool.poolName,
        question: pool.question,
        correctPrediction: correctPrediction,
        declaredAt: pool.resultDeclaredAt,
        rewardSystem: pool.rewardSystem,
        totalPot: totalPot,
        totalWinners: winners.length,
        totalLosers: losers.length,
        totalParticipants: acceptedParticipants.length,
        pointsPerWinner: pool.rewardSystem === "Points Awards" && winners.length > 0 
          ? Math.floor(totalPot / winners.length) 
          : null,
        winnerdata: pool.leaderboard
      }
    });

  } catch (err) {
    console.error("Result declaration error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});


router.get("/pool/:poolId/details", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { poolId } = req.params;

    const pool = await Pool.findById(poolId)
      .populate("createdBy", "name email avatar")
      .populate("participants.userId", "name email avatar");

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    // Check if user is participant or creator
    const isCreator = pool.createdBy._id.toString() === userId.toString();
    const participantIndex = pool.participants.findIndex(
      p => p.userId && p.userId._id.toString() === userId.toString()
    );

    if (!isCreator && participantIndex === -1) {
      return res.status(403).json({
        status: "error",
        message: "You don't have access to this pool"
      });
    }

    const userParticipant = participantIndex !== -1 ? pool.participants[participantIndex] : null;

    // Count predictions
    const totalPredictions = pool.participants.filter(p => p.prediction && p.status === "accepted").length;
    const totalParticipants = pool.participants.filter(p => p.status === "accepted").length;

    res.status(200).json({
      status: "success",
      data: {
        poolId: pool._id,
        poolName: pool.poolName,
        description: pool.description,
        question: pool.question,
        options: pool.options,
        category: pool.category,
        pointsToJoin: pool.pointsToJoin,
        rewardSystem: pool.rewardSystem,
        status: pool.status,
        isCreator: isCreator,
        createdBy: {
          id: pool.createdBy._id,
          name: pool.createdBy.name,
          avatar: pool.createdBy.avatar
        },
        yourStatus: userParticipant ? userParticipant.status : null,
        yourPrediction: userParticipant ? userParticipant.prediction : null,
        yourPredictionSubmittedAt: userParticipant ? userParticipant.predictionSubmittedAt : null,
        yourResultStatus: userParticipant ? userParticipant.resultStatus : null,
        yourPointsEarned: userParticipant ? userParticipant.pointsEarned : 0,
        yourRank: userParticipant ? userParticipant.rank : null,
        totalPredictions: totalPredictions,
        totalParticipants: totalParticipants,
        correctPrediction: pool.correctPrediction || null,
        resultDeclaredAt: pool.resultDeclaredAt || null,
        leaderboard: pool.leaderboard || [],
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt
      }
    });

  } catch (err) {
    console.error("Get pool details error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/notifications", auth, async (req, res) => {
  try {
    const user = req.user;

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: user._id,
      // isRead: false
    });

    res.status(200).json({
      status: "success",
      // unreadCount,
      notifications
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.post("/invitations/:poolId/respond", auth, async (req, res) => {
  try {
    const user = req.user;
    const { poolId } = req.params;
    const { action } = req.body;

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid action. Use 'accept' or 'reject'"
      });
    }

    const pool = await Pool.findById(poolId).populate("createdBy", "name");

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    const participantIndex = pool.participants.findIndex(p =>
      (p.userId?.toString() === user._id.toString()) ||
      (p.email === user.email) ||
      (p.phone === user.phone)
    );

    if (participantIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "You are not invited to this pool"
      });
    }

    const participant = pool.participants[participantIndex];

    if (participant.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `You have already ${participant.status} this invitation`
      });
    }

    // ================= ACCEPT =================
    if (action === "accept") {
      // ✅ CHECK IF USER HAS ENOUGH POINTS
      if (user.totalPoints < pool.pointsToJoin) {
        return res.status(403).json({
          status: "error",
          message: "Insufficient points to join this pool",
          required: pool.pointsToJoin,
          available: user.totalPoints
        });
      }

      // ✅ DEDUCT POINTS FROM USER
      user.totalPoints -= pool.pointsToJoin;
      await user.save();

      pool.participants[participantIndex].status = "accepted";
      pool.participants[participantIndex].userId = user._id;
      pool.participants[participantIndex].name = user.name;

      await Notification.findOneAndUpdate(
        {
          userId: user._id,
          "data.poolId": poolId,
          type: "pool_invitation"
        },
        {
          $set: {
            type: "pool_accepted",
            status: "accepted",
            message: `You accepted the invitation to join "${pool.poolName}" (${pool.pointsToJoin} points deducted)`
          }
        }
      );

      await sendInAppNotification(pool.createdBy._id, {
        type: "pool_accepted",
        title: "Invitation Accepted",
        message: `${user.name} accepted your invitation to "${pool.poolName}"`,
        data: {
          poolId: pool._id,
          poolName: pool.poolName,
          acceptedByName: user.name,
          acceptedById: user._id
        }
      });
    }

    // ================= REJECT =================
    if (action === "reject") {
      pool.participants[participantIndex].status = "rejected";

      await Notification.findOneAndUpdate(
        {
          userId: user._id,
          "data.poolId": poolId,
          type: "pool_invitation"
        },
        {
          $set: {
            type: "pool_rejected",
            status: "rejected",
            message: `You declined the invitation to join "${pool.poolName}"`
          }
        }
      );

      await sendInAppNotification(pool.createdBy._id, {
        type: "pool_rejected",
        title: "Invitation Rejected",
        message: `${user.name} declined your invitation to "${pool.poolName}"`,
        data: {
          poolId: pool._id,
          poolName: pool.poolName,
          rejectedByName: user.name,
          rejectedById: user._id
        }
      });
    }

    await pool.save();

    const acceptedCount = pool.participants.filter(
      p => p.status === "accepted"
    ).length;

    res.status(200).json({
      status: "success",
      message: action === "accept" 
        ? `Invitation accepted successfully. ${pool.pointsToJoin} points deducted.`
        : "Invitation rejected successfully",
      pool: {
        id: pool._id,
        poolName: pool.poolName,
        participantsCount: acceptedCount
      },
      pointsDeducted: action === "accept" ? pool.pointsToJoin : 0,
      remainingPoints: user.totalPoints
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}); 
router.post('/pool/invite/responded',(req,res)=>{
  try{
    const {poolId,inviteLinkid,userId,action}= req.body;
    if(lId){
      Pool.findById(poolId).then(async(pool)=>{
        if(!pool){

          return res.status(404).json({
            success:false,
            message:"pool not found"
            // message:"pool not found it is true that vijay thalapthy do not do any more movies becuase he will focus on his politic career and january 2026 he officially join dmk"
          })
        }
      })
    }
    res.status(200).json({
      status:"success",
      message:"user has responded to the invite link"
    })

  }catch(error){
    res.status(500).json({
      status:"error",
      message:error.message
    })
  }
})
router.post("/pool/correctparidication", async(req,res)=>{
  try {
    const poolid= req.params
    const  pool = await  Pool.findById(poolid);
  } catch (error) {
    status:error,
    res.send(error.message)
  }
})

// router.post("/pool/:poolId/reopen", auth, async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { poolId } = req.params;


//     const pool = await Pool.findById(poolId).populate("participants.userId", "name email");

//     if (!pool) {
//       return res.status(404).json({
//         status: "error",
//         message: "Pool not found"
//       });
//     }

   
//     if (pool.createdBy.toString() !== userId.toString()) {
//       return res.status(403).json({
//         status: "error",
//         message: "Only the pool creator can reopen this pool"
//       });
//     }


//     if (!pool.correctPrediction || pool.status !== "completed") {
//       return res.status(400).json({
//         status: "error",
//         message: "Pool has not been completed yet. Only completed pools can be reopened."
//       });
//     }

  
//     const winnersRefunded = [];
    
//     for (const participant of pool.participants) {
//       if (participant.pointsEarned && participant.pointsEarned > 0 && participant.userId) {
        
//         await User.findByIdAndUpdate(participant.userId._id, {
//           $inc: { totalPoints: -participant.pointsEarned }
//         });

//         winnersRefunded.push({
//           userId: participant.userId._id,
//           name: participant.name,
//           pointsRefunded: participant.pointsEarned
//         });

//         await sendInAppNotification(participant.userId._id, {
//           type: "pool_reopened",
//           title: "Pool Reopened",
//           message: `"${pool.poolName}" has been reopened. Your ${participant.pointsEarned} points have been refunded.`,
//           data: {
//             poolId: pool._id,
//             poolName: pool.poolName,
//             pointsRefunded: participant.pointsEarned
//           }
//         });
//       }
//     }

    
//     pool.participants.forEach(participant => {
//       if (participant.status === "accepted") {
//         participant.prediction = null;
//         participant.predictionSubmittedAt = null;
//         participant.resultStatus = null;
//         participant.pointsEarned = 0;
//         participant.score = 0;
//         participant.rank = null;
//       }
//     });

//     // Clear pool results
//     pool.correctPrediction = null;
//     pool.resultDeclaredAt = null;
//     pool.status = "active";
//     pool.leaderboard = [];

//     await pool.save();

//     // Notify all participants that pool has been reopened
//     for (const participant of pool.participants) {
//       if (participant.userId && participant.status === "accepted") {
//         // Skip if already notified above (winner)
//         if (!winnersRefunded.find(w => w.userId.toString() === participant.userId._id.toString())) {
//           await sendInAppNotification(participant.userId._id, {
//             type: "pool_reopened",
//             title: "Pool Reopened",
//             message: `"${pool.poolName}" has been reopened. You can submit your prediction again.`,
//             data: {
//               poolId: pool._id,
//               poolName: pool.poolName
//             }
//           });
//         }
//       }
//     }

//     res.status(200).json({
//       status: "success",
//       message: "Pool reopened successfully",
//       data: {
//         poolId: pool._id,
//         poolName: pool.poolName,
//         status: pool.status,
//         winnersRefunded: winnersRefunded.length,
//         totalPointsRefunded: winnersRefunded.reduce((sum, w) => sum + w.pointsRefunded, 0),
//         participantsReset: pool.participants.filter(p => p.status === "accepted").length,
//         // refundDetails: winnersRefunded
//       }
//     });

//   } catch (err) {
//     console.error("Reopen pool error:", err);
//     res.status(500).json({
//       status: "error",
//       message: err.message
//     });
//   }
// });

// router.get("/pool/result", auth, async (req, res) => {
//   try {
//     const userId = req.user._id;

//     const pools = await Pool.find({
//       $or: [
//         { createdBy: userId },
//         { "participants.userId": userId },
//         { invitedUsers: userId }
//       ]
//     })
//       .select(
//         "poolName category leaderboard participants status correctPrediction pointsToJoin updatedAt"
//       )
//       .sort({ updatedAt: -1 });

//     // ✅ FILTER: ONLY COMPLETED POOLS
//     const completedPools = pools.filter(pool => pool.status === "completed");

//     if (!completedPools.length) {
//       return res.status(404).json({
//         status: "fail",
//         message: "No completed pool results found"
//       });
//     }

//     const categoryIds = [];
//     const categoryNames = [];

//     completedPools.forEach(pool => {
//       if (pool.category) {
//         const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
//         isObjectId ? categoryIds.push(pool.category) : categoryNames.push(pool.category);
//       }
//     });

//     const categories = await Category.find({
//       $or: [
//         { _id: { $in: [...new Set(categoryIds)] } },
//         { name: { $in: [...new Set(categoryNames)] } }
//       ]
//     });

//     const categoryMapById = {};
//     const categoryMapByName = {};

//     categories.forEach(cat => {
//       const data = { id: cat._id, name: cat.name, icon: cat.icon };
//       categoryMapById[cat._id.toString()] = data;
//       categoryMapByName[cat.name] = data;
//     });

//     let totalEarnedPoints = 0;
//     let totalLostPoints = 0;

    
//     const results = completedPools.map(pool => {
//       const participant = pool.participants?.find(
//         p => p.userId?.toString() === userId.toString()
//       );

//       const leaderboardUser = pool.leaderboard?.find(
//         lb => lb.userId?.toString() === userId.toString()
//       );

//       let categoryDetails = null;
//       if (pool.category) {
//         const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
//         categoryDetails = isObjectId
//           ? categoryMapById[pool.category.toString()]
//           : categoryMapByName[pool.category];
//       }

//       let displayPoints = 0;
//       let userResult = "no_result";
//       let userPrediction = null;

//       if (participant) {
//         userPrediction = participant.prediction || null;

//         if (participant.resultStatus === "won") {
//           displayPoints = participant.pointsEarned || 0;
//           userResult = "won";
//           totalEarnedPoints += displayPoints;
//         } else {
//           totalLostPoints += pool.pointsToJoin;
//         }
//       } else {
//         totalLostPoints += pool.pointsToJoin;
//       }

//       return {
//         id: pool._id,
//         title: pool.poolName,
//         category: categoryDetails?.name || null,
//         prediction: userPrediction || "Not predicted yet",
//         rank: leaderboardUser?.rank || null,
//         points: leaderboardUser?.points || 0,
//         resultInfo: {
//           correctPrediction: pool.correctPrediction || null,
//           userPointsEarned: displayPoints,
//           userPointsLost: pool.pointsToJoin, // ✅ ALWAYS
//           userPrediction,
//           userResult,
//           displayText:
//             displayPoints > 0
//               ? `Win Points +${displayPoints}`
//               : displayPoints < 0
//               ? `Lost Points ${displayPoints}`
//               : "No Result"
//         }
//       };
//     });

//     res.status(200).json({
//       status: "success",
//       message: "User completed pool results fetched successfully",
//       // total: results.length,
//       // totalEarnedPoints,
//       // totalLostPoints,
//       data: results
//     });
//   } catch (err) {
//     console.error("Pool results error:", err);
//     res.status(500).json({
//       status: "fail",
//       message: err.message
//     });
//   }
// });

// router.get("/pool/head-to-head", auth, async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const usercategory = req.user.category;
//     const userPools = await Pool.find({
//       "participants.userId": userId,
//       "participants.status": "accepted"
//     }).populate("participants.userId", "name avatar");
    
//     const h2hMap = {};
    
//     userPools.forEach(pool => {
//       const acceptedParticipants = pool.participants.filter(
//         p => p.status === "accepted" && p.userId
//       );

//       acceptedParticipants.forEach(participant => {
//         if (participant.userId._id.toString() === userId.toString()) return;
        
//         const opponentId = participant.userId._id.toString();
        
//         if (!h2hMap[opponentId]) {
//           h2hMap[opponentId] = {
//             opponent: participant.userId,
//             poolsPlayedTogether: 0,
//             userTotalPoints: 0,
//             opponentTotalPoints: 0
//           };
//         }

//         h2hMap[opponentId].poolsPlayedTogether++;
        
      
//         const currentUser = pool.participants.find(
//           p => p.userId?._id.toString() === userId.toString()
//         );
//         const currentOpponent = pool.participants.find(
//           p => p.userId?._id.toString() === opponentId
//         );


//         h2hMap[opponentId].userTotalPoints += currentUser?.pointsEarned || 0;
//         h2hMap[opponentId].opponentTotalPoints += currentOpponent?.pointsEarned || 0;
//       });
//     });

//     const h2hStats = Object.values(h2hMap).map(stat => ({
//       player1: {
//         id: userId,
//         name: req.user.name,
//         avatar: req.user.avatar
//       },
//       player2: {
//         id: stat.opponent._id,
//         name: stat.opponent.name,
//         avatar: stat.opponent.avatar
//       },
//       poolsPlayedTogether: stat.poolsPlayedTogether,
//       pointsDifference: Math.abs(stat.userTotalPoints - stat.opponentTotalPoints),
//       player1TotalPoints: stat.userTotalPoints,
//       player2TotalPoints: stat.opponentTotalPoints
//     }));

//     h2hStats.sort((a, b) => b.poolsPlayedTogether - a.poolsPlayedTogether);

//     res.status(200).json({
//       status: "success",
//       data: h2hStats
//     });

//   } catch (err) {
//     res.status(500).json({
//       status: "error",
//       message: err.message
//     });
//   }
// });
// ✅ FIXED: Pool Result API - Only show after user prediction + result declared
router.get("/pool/result", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const pools = await Pool.find({
      $or: [
        { createdBy: userId },
        { "participants.userId": userId }
      ]
    })
      .select("poolName category participants status correctPrediction pointsToJoin resultDeclaredAt updatedAt")
      .sort({ updatedAt: -1 });

    // ✅ FILTER: Only completed pools where user has submitted prediction
    const completedPools = pools.filter(pool => {
      if (pool.status !== "completed") return false;
      
      const participant = pool.participants?.find(
        p => p.userId?.toString() === userId.toString()
      );
      
      // ✅ Only show if user submitted a prediction
      return participant && participant.prediction;
    });

    if (!completedPools.length) {
      return res.status(200).json({
        status: "success",
        message: "No results available yet",
        data: []
      });
    }

    // Fetch categories
    const categoryIds = [];
    const categoryNames = [];

    completedPools.forEach(pool => {
      if (pool.category) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
        isObjectId ? categoryIds.push(pool.category) : categoryNames.push(pool.category);
      }
    });

    const categories = await Category.find({
      $or: [
        { _id: { $in: [...new Set(categoryIds)] } },
        { name: { $in: [...new Set(categoryNames)] } }
      ]
    });

    const categoryMapById = {};
    const categoryMapByName = {};

    categories.forEach(cat => {
      const data = { id: cat._id, name: cat.name, icon: cat.icon };
      categoryMapById[cat._id.toString()] = data;
      categoryMapByName[cat.name] = data;
    });

    let totalEarnedPoints = 0;
    let totalLostPoints = 0;

    const results = completedPools.map(pool => {
      const participant = pool.participants?.find(
        p => p.userId?.toString() === userId.toString()
      );

      let categoryDetails = null;
      if (pool.category) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(pool.category);
        categoryDetails = isObjectId
          ? categoryMapById[pool.category.toString()]
          : categoryMapByName[pool.category];
      }

      let displayPoints = 0;
      let userResult = "lost";
      let userPrediction = participant?.prediction || null;
      let pointsLost = 0;

      if (participant.resultStatus === "won") {
        displayPoints = participant.pointsEarned || 0;
        userResult = "won";
        totalEarnedPoints += displayPoints;
      } else {
        // ✅ User lost - show points deducted
        pointsLost = pool.pointsToJoin;
        totalLostPoints += pointsLost;
      }

      return {
        id: pool._id,
        title: pool.poolName,
        category: categoryDetails?.name || null,
        categoryIcon: categoryDetails?.icon || null,
        prediction: userPrediction,
        correctAnswer: pool.correctPrediction,
        declaredAt: pool.resultDeclaredAt,
        resultInfo: {
          userResult, // "won" or "lost"
          pointsEarned: displayPoints,
          pointsLost: pointsLost,
          rank: participant?.rank || null,
          displayText: userResult === "won" 
            ? `+${displayPoints} Points` 
            : `-${pointsLost} Points`
        }
      };
    });

    res.status(200).json({
      status: "success",
      message: "Results fetched successfully",
      // summary: {
      //   totalEarnedPoints,
      //   totalLostPoints,
      //   netPoints: totalEarnedPoints - totalLostPoints
      // },
      data: results
    });
  } catch (err) {
    console.error("Pool results error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

// ✅ FIXED: Head-to-Head API - Only count completed pools with declared results
router.get("/pool/head-to-head", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ Only fetch COMPLETED pools where result is declared
    const userPools = await Pool.find({
      "participants.userId": userId,
      "participants.status": "accepted",
      status: "completed", // ✅ Must be completed
      correctPrediction: { $exists: true, $ne: null } 
    }).populate("participants.userId", "name avatar");
    
    const h2hMap = {};
    
    userPools.forEach(pool => {
      const acceptedParticipants = pool.participants.filter(
        p => p.status === "accepted" && p.userId && p.prediction 
      );

      acceptedParticipants.forEach(participant => {
        if (participant.userId._id.toString() === userId.toString()) return;
        
        const opponentId = participant.userId._id.toString();
        
        if (!h2hMap[opponentId]) {
          h2hMap[opponentId] = {
            opponent: participant.userId,
            poolsPlayedTogether: 0,
            userWins: 0,
            opponentWins: 0,
            userTotalPoints: 0,
            opponentTotalPoints: 0
          };
        }

        h2hMap[opponentId].poolsPlayedTogether++;
        
        // Find both users in this pool
        const currentUser = pool.participants.find(
          p => p.userId?._id.toString() === userId.toString()
        );
        const currentOpponent = pool.participants.find(
          p => p.userId?._id.toString() === opponentId
        );

        // ✅ Only count points if result is declared
        if (pool.correctPrediction) {
          const userPoints = currentUser?.pointsEarned || 0;
          const opponentPoints = currentOpponent?.pointsEarned || 0;

          h2hMap[opponentId].userTotalPoints += userPoints;
          h2hMap[opponentId].opponentTotalPoints += opponentPoints;

          // Track wins
          if (currentUser?.resultStatus === "won") {
            h2hMap[opponentId].userWins++;
          }
          if (currentOpponent?.resultStatus === "won") {
            h2hMap[opponentId].opponentWins++;
          }
        }
      });
    });

    const h2hStats = Object.values(h2hMap).map(stat => ({
      player1: {
        id: userId,
        name: req.user.name,
        avatar: req.user.avatar
      },
      player2: {
        id: stat.opponent._id,
        name: stat.opponent.name,
        avatar: stat.opponent.avatar
      },
      poolsPlayedTogether: stat.poolsPlayedTogether,
      player1Wins: stat.userWins,
      player2Wins: stat.opponentWins,
      player1TotalPoints: stat.userTotalPoints,
      player2TotalPoints: stat.opponentTotalPoints,
      pointsDifference: Math.abs(stat.userTotalPoints - stat.opponentTotalPoints)
    }));

    // Sort by most pools played together
    h2hStats.sort((a, b) => b.poolsPlayedTogether - a.poolsPlayedTogether);

    res.status(200).json({
      status: "success",
      message: "Head-to-head stats fetched successfully",
      data: h2hStats
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

// ✅ ENHANCED: Reopen endpoint - Clear all result data properly
router.post("/pool/:poolId/reopen", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { poolId } = req.params;

    const pool = await Pool.findById(poolId).populate("participants.userId", "name email");

    if (!pool) {
      return res.status(404).json({
        status: "error",
        message: "Pool not found"
      });
    }

    if (pool.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Only the pool creator can reopen this pool"
      });
    }

    if (!pool.correctPrediction || pool.status !== "completed") {
      return res.status(400).json({
        status: "error",
        message: "Pool has not been completed yet"
      });
    }

    const winnersRefunded = [];
    
    // ✅ Refund points to winners
    for (const participant of pool.participants) {
      if (participant.pointsEarned && participant.pointsEarned > 0 && participant.userId) {
        await User.findByIdAndUpdate(participant.userId._id, {
          $inc: { totalPoints: -participant.pointsEarned }
        });

        winnersRefunded.push({
          userId: participant.userId._id,
          name: participant.name,
          pointsRefunded: participant.pointsEarned
        });

        await sendInAppNotification(participant.userId._id, {
          type: "pool_reopened",
          title: "Pool Reopened",
          message: `"${pool.poolName}" has been reopened. Your ${participant.pointsEarned} points have been refunded.`,
          data: {
            poolId: pool._id,
            poolName: pool.poolName,
            pointsRefunded: participant.pointsEarned
          }
        });
      }
    }

    // ✅ RESET ALL PARTICIPANT DATA
    pool.participants.forEach(participant => {
      if (participant.status === "accepted") {
        participant.prediction = null;
        participant.predictionSubmittedAt = null;
        participant.resultStatus = null;
        participant.pointsEarned = 0;
        participant.score = 0;
        participant.rank = null;
      }
    });

    // ✅ RESET ALL POOL RESULT DATA
    pool.correctPrediction = null;
    pool.resultDeclaredAt = null;
    pool.status = "active";
    pool.leaderboard = [];

    await pool.save();

    // Notify all partic  `ipants
    for (const participant of pool.participants) {
      if (participant.userId && participant.status === "accepted") {
        if (!winnersRefunded.find(w => w.userId.toString() === participant.userId._id.toString())) {
          await sendInAppNotification(participant.userId._id, {
            type: "pool_reopened",
            title: "Pool Reopened",
            message: `"${pool.poolName}" has been reopened. Submit your prediction again.`,
            data: {
              poolId: pool._id,
              poolName: pool.poolName
            }
          });
        }
      }
    }

    res.status(200).json({
      status: "success",
      message: "Pool reopened successfully. All results and predictions cleared.",
      data: {
        poolId: pool._id,
        poolName: pool.poolName,
        status: pool.status,
        winnersRefunded: winnersRefunded.length,
        totalPointsRefunded: winnersRefunded.reduce((sum, w) => sum + w.pointsRefunded, 0)
      }
    });

  } catch (err) {
    console.error("Reopen pool error:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
module.exports = router;

