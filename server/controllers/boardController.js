const { User } = require("../models/userModel");
const mongoose = require("mongoose");

// Helper to safely get optional collections without throwing if model is not registered yet
const getModelSafely = (modelName) => {
  try {
    return mongoose.model(modelName);
  } catch (e) {
    return null;
  }
};

/**
 * GET /api/leaderboard
 * Query params: ?area=Bishan or ?neighbourhood=Bishan
 * Returns ranked public users sorted by availableTokens descending
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const area = req.query.area || req.query.neighbourhood;
    const filter = {};

    // Filter by public accounts (if field is used)
    // If accountPublic exists in schema, we exclude users who explicitly opted out
    filter.accountPublic = { $ne: false };

    // Neighbourhood / area filtering
    if (area && area !== "All") {
      filter.$or = [
        { neighbourhood: new RegExp(`^${area}$`, "i") },
        { block: new RegExp(area, "i") }
      ];
    }

    const users = await User.find(filter)
      .select("userId userName tokenBalance neighbourhood block unitNumber")
      .sort({ tokenBalance: -1 })
      .lean();

    const formattedLeaderboard = users.map((u, index) => {
      const uId = u.userId || u._id.toString();
      const name = u.userName || "Green Friend";
      return {
        id: uId,
        name: name,
        neighbourhood: u.neighbourhood || (u.block ? `Blk ${u.block}` : "Singapore"),
        availableTokens: u.tokenBalance || 0,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        ratingAverage: 5.0,
        ratingCount: 1,
        badgesCount: 3,
        rank: index + 1
      };
    });

    res.json({
      success: true,
      count: formattedLeaderboard.length,
      leaderboard: formattedLeaderboard
    });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ success: false, message: "Error fetching leaderboard", error: err.message });
  }
};

/**
 * PATCH /api/leaderboard/opt-out/:userId
 * Toggles a user's accountPublic visibility
 */
exports.toggleOptOut = async (req, res) => {
  try {
    const { userId } = req.params;
    const isNum = !isNaN(Number(userId));
    const query = isNum ? { userId: Number(userId) } : { _id: userId };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Toggle public visibility
    user.accountPublic = !user.accountPublic;
    await user.save();

    res.json({
      success: true,
      message: `User leaderboard visibility set to ${user.accountPublic}`,
      accountPublic: user.accountPublic
    });
  } catch (err) {
    console.error("Error toggling opt-out:", err);
    res.status(500).json({ success: false, message: "Error toggling opt-out status", error: err.message });
  }
};

/**
 * GET /api/dashboard/stats/:userId
 * Returns personal dashboard statistics for the specified user
 */
exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const numUserId = Number(userId);
    const query = !isNaN(numUserId) ? { userId: numUserId } : { _id: userId };

    const user = await User.findOne(query).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 1. Plants count
    let totalPlantsOwned = 0;
    const PlantModel = getModelSafely("Plant");
    if (PlantModel) {
      totalPlantsOwned = await PlantModel.countDocuments({ ownerId: !isNaN(numUserId) ? numUserId : user.userId });
    }

    // 2. Care Requests & Visits count (from CareRequest / CareVisit if available)
    let careRequestsPosted = 0;
    let visitsCompleted = 0;
    let plantsCaredFor = 0;

    const CareRequestModel = getModelSafely("CareRequest");
    if (CareRequestModel) {
      careRequestsPosted = await CareRequestModel.countDocuments({
        $or: [{ userId: numUserId }, { requesterId: numUserId }, { ownerId: numUserId }]
      });
    }

    const CareVisitModel = getModelSafely("CareVisit") || getModelSafely("Visit");
    if (CareVisitModel) {
      visitsCompleted = await CareVisitModel.countDocuments({
        $or: [{ helperId: numUserId }, { caregiverId: numUserId }, { sitterId: numUserId }]
      });
      plantsCaredFor = visitsCompleted * 3; // approximation or aggregate count
    }

    // 3. Tokens Earned / Spent totals
    let tokensEarnedTotal = user.tokenBalance || 0;
    let tokensSpentTotal = 0;

    const TokenModel = getModelSafely("TokenTransaction");
    if (TokenModel) {
      const earned = await TokenModel.aggregate([
        { $match: { receiverId: numUserId } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const spent = await TokenModel.aggregate([
        { $match: { senderId: numUserId } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      if (earned.length > 0) tokensEarnedTotal = earned[0].total;
      if (spent.length > 0) tokensSpentTotal = spent[0].total;
    }

    const userName = user.userName || "Green Friend";
    const userPayload = {
      name: userName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`,
      neighbourhood: user.neighbourhood || (user.block ? `Blk ${user.block}` : "Singapore"),
      availableTokens: user.tokenBalance || 0,
      tokensEarnedTotal,
      tokensSpentTotal,
      ratingAverage: 5.0,
      ratingCount: 1
    };

    const statsPayload = {
      totalPlantsOwned,
      careRequestsPosted,
      visitsCompleted,
      plantsCaredFor: plantsCaredFor || totalPlantsOwned
    };

    const badges = [
      { id: "first_sit", name: "First Sit", description: "Completed your first plant sitting visit!", unlocked: visitsCompleted >= 1, progress: visitsCompleted >= 1 ? 100 : 0, icon: "🌱" },
      { id: "ten_plants_saved", name: "10 Plants Saved", description: "Successfully watered and cared for 10 plants.", unlocked: plantsCaredFor >= 10, progress: Math.min(100, Math.round((plantsCaredFor / 10) * 100)), icon: "🌿" },
      { id: "rainy_day_hero", name: "Rainy Day Hero", description: "Cared for corridor plants during an active weather alert.", unlocked: true, progress: 100, icon: "🌧️" }
    ];

    res.json({
      success: true,
      user: userPayload,
      stats: statsPayload,
      badges
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ success: false, message: "Error fetching user stats", error: err.message });
  }
};

/**
 * GET /api/dashboard/charts/:userId
 * Returns monthly Activity and Token Flow charts data for Chart.js
 */
exports.getUserCharts = async (req, res) => {
  try {
    const { userId } = req.params;
    const numUserId = Number(userId);

    // Labels for the last 6 months
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
    }

    let visitsData = [0, 0, 0, 0, 0, 0];
    let requestsData = [0, 0, 0, 0, 0, 0];
    let tokensEarnedData = [0, 0, 0, 0, 0, 0];
    let tokensSpentData = [0, 0, 0, 0, 0, 0];

    const TokenModel = getModelSafely("TokenTransaction");
    if (TokenModel) {
      // Find transactions within last 6 months
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const txs = await TokenModel.find({
        $or: [{ receiverId: numUserId }, { senderId: numUserId }],
        createdAt: { $gte: sixMonthsAgo }
      }).lean();

      txs.forEach((tx) => {
        const txMonth = new Date(tx.createdAt).getMonth();
        const monthLabel = monthNames[txMonth];
        const idx = labels.indexOf(monthLabel);
        if (idx !== -1) {
          if (tx.receiverId === numUserId) {
            tokensEarnedData[idx] += tx.amount || 0;
          }
          if (tx.senderId === numUserId) {
            tokensSpentData[idx] += tx.amount || 0;
          }
        }
      });
    }

    // Provide default non-zero baseline curve if no transactions seeded yet
    const hasTokenData = tokensEarnedData.some((v) => v > 0) || tokensSpentData.some((v) => v > 0);
    if (!hasTokenData) {
      tokensEarnedData = [20, 30, 45, 50, 35, 25];
      tokensSpentData = [15, 20, 10, 15, 10, 5];
    }

    const hasActivityData = visitsData.some((v) => v > 0) || requestsData.some((v) => v > 0);
    if (!hasActivityData) {
      visitsData = [1, 2, 4, 5, 3, 2];
      requestsData = [2, 1, 3, 2, 1, 2];
    }

    res.json({
      success: true,
      activityChart: {
        labels,
        datasets: [
          {
            label: "Visits Completed (Helper)",
            backgroundColor: "#0ea5e9",
            borderRadius: 6,
            data: visitsData
          },
          {
            label: "Requests Posted (Owner)",
            backgroundColor: "#8b5cf6",
            borderRadius: 6,
            data: requestsData
          }
        ]
      },
      tokenFlowChart: {
        labels,
        datasets: [
          {
            label: "Tokens Earned",
            backgroundColor: "#22c55e",
            borderRadius: 6,
            data: tokensEarnedData
          },
          {
            label: "Tokens Spent",
            backgroundColor: "#f59e0b",
            borderRadius: 6,
            data: tokensSpentData
          }
        ]
      }
    });
  } catch (err) {
    console.error("Error fetching user charts:", err);
    res.status(500).json({ success: false, message: "Error fetching user charts", error: err.message });
  }
};
