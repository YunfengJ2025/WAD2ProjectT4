const { User, tokenSummary } = require("../models/userModel");
const mongoose = require("mongoose");

const getCollection = (collectionName) => {
  return mongoose.connection.db.collection(collectionName);
};

// GET /api/leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const area = req.query.area || req.query.neighbourhood;
    const filter = {
      hideFromLeaderboard: { $ne: true },
    };

    if (area && area !== "All") {
      filter.$or = [
        { neighbourhood: new RegExp(`^${area}$`, "i") },
        { block: new RegExp(area, "i") },
      ];
    }

    const users = await User.find(filter)
      .select(
        "userId userName photoUrl tokenBalance neighbourhood block unitNumber accountPublic hideFromLeaderboard",
      )
      .sort({ tokenBalance: -1 })
      .lean();

    // Aggregate average ratings and counts from reviews
    const ratingMap = {};
    try {
      const reviewCol = getCollection("reviews");
      const reviewAgg = await reviewCol
        .aggregate([
          { $match: { type: "VISIT", rating: { $ne: null } } },
          {
            $group: {
              _id: "$receiverId",
              avgRating: { $avg: "$rating" },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      for (const row of reviewAgg) {
        ratingMap[String(row._id)] = {
          avg: Number(row.avgRating.toFixed(1)),
          count: row.count,
        };
      }
    } catch (e) {}

    const formattedLeaderboard = users.map((u, index) => {
      const uId = u.userId || u._id.toString();
      const name = u.userName || "Green Friend";
      const userRating = ratingMap[String(u.userId)] || ratingMap[String(u._id)];
      const avg = userRating ? userRating.avg : 5.0;
      const count = userRating ? userRating.count : 0;

      return {
        id: uId,
        name: name,
        photoUrl: u.photoUrl || "",
        neighbourhood:
          u.neighbourhood || (u.block ? `Blk ${u.block}` : "Singapore"),
        availableTokens: u.tokenBalance || 0,
        avatarUrl: u.photoUrl && u.photoUrl.trim() !== "" ? u.photoUrl : "",
        ratingAverage: avg,
        ratingCount: count,
        badgesCount: 3,
        rank: index + 1,
        accountPublic: u.accountPublic,
        hideFromLeaderboard: Boolean(u.hideFromLeaderboard),
      };
    });

    res.json({
      success: true,
      count: formattedLeaderboard.length,
      leaderboard: formattedLeaderboard,
    });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching leaderboard",
        error: err.message,
      });
  }
};

// GET /api/leaderboard/status/:userId
exports.getOptOutStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const isNum = !isNaN(Number(userId));
    const query = isNum ? { userId: Number(userId) } : { _id: userId };

    const user = await User.findOne(query).select("hideFromLeaderboard");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      hideFromLeaderboard: Boolean(user.hideFromLeaderboard),
    });
  } catch (err) {
    console.error("Error getting leaderboard status:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error getting status",
        error: err.message,
      });
  }
};

// PATCH /api/leaderboard/opt-out/:userId
exports.toggleOptOut = async (req, res) => {
  try {
    const { userId } = req.params;
    const isNum = !isNaN(Number(userId));
    const targetUserId = isNum ? Number(userId) : userId;

    // Authorization check: ensure logged-in user can only change their own visibility
    if (req.user && req.userId != null) {
      const callerId = req.user.userId ?? req.userId;
      const callerMongoId = req.user._id ? String(req.user._id) : null;
      const matchesCaller = (isNum && callerId === targetUserId) || String(targetUserId) === callerMongoId;
      if (!matchesCaller) {
        return res.status(403).json({ success: false, message: "You can only modify your own leaderboard privacy" });
      }
    }

    const query = isNum ? { userId: targetUserId } : { _id: userId };

    const user = await User.findOne(query);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.hideFromLeaderboard = !user.hideFromLeaderboard;
    user.accountPublic = !user.hideFromLeaderboard;
    await user.save();

    res.json({
      success: true,
      message: `User leaderboard visibility set to ${user.hideFromLeaderboard ? "hidden" : "visible"}`,
      hideFromLeaderboard: user.hideFromLeaderboard,
      accountPublic: user.accountPublic,
    });
  } catch (err) {
    console.error("Error toggling opt-out:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error toggling opt-out status",
        error: err.message,
      });
  }
};

// Calculate user badges and persist unlocked ones to DB
async function syncUserBadges(userId) {
  try {
    const numUserId = Number(userId);
    const query = !isNaN(numUserId) ? { userId: numUserId } : { _id: userId };

    const user = await User.findOne(query).lean();
    if (!user) return null;

    const effectiveOwnerId = !isNaN(numUserId) ? numUserId : user.userId;

    // 1. Plants count
    let totalPlantsOwned = 0;
    let distinctPlantTypes = 0;
    try {
      const plantCol = getCollection("Plant");
      totalPlantsOwned = await plantCol.countDocuments({ ownerId: effectiveOwnerId });
      const distinctNames = await plantCol.distinct("plantName", { ownerId: effectiveOwnerId });
      distinctPlantTypes = distinctNames && distinctNames.length > 0 ? distinctNames.length : totalPlantsOwned;
    } catch (e) {}

    // 2. Care Requests & Visits count
    let careRequestsPosted = 0;
    let visitsCompleted = 0;
    let plantsCaredFor = 0;
    let photoProofCount = 0;
    let userVisits = [];
    let visitIds = [];

    try {
      const seenReqIds = new Set();
      let uniqueReqs = [];
      for (const reqColName of ["carerequests", "CareRequest"]) {
        try {
          const reqCol = getCollection(reqColName);
          const reqDocs = await reqCol
            .find({
              $or: [
                { requesterId: numUserId },
                { ownerId: numUserId },
                { userId: numUserId },
              ],
            })
            .toArray();
          for (const r of reqDocs) {
            const key = String(r.requestId || r._id);
            if (!seenReqIds.has(key)) {
              seenReqIds.add(key);
              uniqueReqs.push(r);
            }
          }
        } catch (colErr) {}
      }
      careRequestsPosted = uniqueReqs.length;
    } catch (e) {}

    try {
      const visitCollections = ["carevisits", "CareVisit"];
      const seenVisitIds = new Set();
      userVisits = [];

      for (const colName of visitCollections) {
        try {
          const col = getCollection(colName);
          const docs = await col
            .find({
              $or: [{ sitterId: numUserId }, { helperId: numUserId }],
            })
            .toArray();
          for (const d of docs) {
            const key = String(d.visitId || d._id);
            if (!seenVisitIds.has(key)) {
              seenVisitIds.add(key);
              userVisits.push(d);
            }
          }
        } catch (colErr) {}
      }

      visitsCompleted = userVisits.length;
      plantsCaredFor = visitsCompleted * 3;

      visitIds = userVisits.map((v) => v.visitId).filter(Boolean);
      if (visitIds.length > 0) {
        const photoCol = getCollection("PhotoProof");
        photoProofCount = await photoCol.countDocuments({
          visitId: { $in: visitIds },
        });
        try {
          const photoColLower = getCollection("photoproofs");
          const lowerCount = await photoColLower.countDocuments({
            visitId: { $in: visitIds },
          });
          photoProofCount += lowerCount;
        } catch (e) {}
      }
      if (photoProofCount === 0 && visitsCompleted > 0) {
        photoProofCount = Math.min(visitsCompleted, 3);
      }
    } catch (e) {}

    // 3. Reviews metrics
    let fiveStarReviewsCount = 0;
    try {
      const reviewCol = getCollection("reviews");
      const userReviews = await reviewCol
        .find({
          receiverId: numUserId,
          type: "VISIT",
          rating: { $ne: null },
        })
        .toArray();

      if (userReviews.length > 0) {
        fiveStarReviewsCount = userReviews.filter((r) => r.rating === 5).length;
      } else if (visitsCompleted >= 2) {
        fiveStarReviewsCount = Math.min(visitsCompleted, 4);
      }
    } catch (e) {}

    // 4. Tokens Earned
    let tokensEarnedTotal = user.tokenBalance || 0;
    try {
      const tokenCol = getCollection("tokentransactions");
      const earned = await tokenCol
        .aggregate([
          { $match: { receiverId: numUserId } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray();
      if (earned.length > 0) tokensEarnedTotal = earned[0].total;
    } catch (e) {}

    // 5. Rainy Day visits
    let rainyVisitsCount = 0;
    try {
      for (const colName of ["carevisits", "CareVisit"]) {
        try {
          const col = getCollection(colName);
          const rainyDocs = await col.countDocuments({
            $or: [{ sitterId: numUserId }, { helperId: numUserId }],
            weatherAlert: { $in: ["rain", "thunder", "shower"] },
          });
          rainyVisitsCount += rainyDocs;
        } catch (colErr) {}
      }

      if (rainyVisitsCount === 0 && visitIds.length > 0) {
        const reqItemCol = getCollection("RequestItem");
        const rainItemCount = await reqItemCol.countDocuments({
          visitId: { $in: visitIds },
          $or: [
            { adjustmentType: "skipped-rain" },
            { adjustmentReason: { $regex: /rain/i } },
          ],
        });
        rainyVisitsCount += rainItemCount;
      }
    } catch (e) {}

    const badges = [
      {
        id: "first_sit",
        name: "First Sit",
        description: "Completed your first plant sitting visit!",
        unlocked: visitsCompleted >= 1,
        progress: visitsCompleted >= 1 ? 100 : 0,
        icon: "🌱",
      },
      {
        id: "ten_plants_saved",
        name: "10 Plants Saved",
        description: "Successfully watered and cared for 10 plants.",
        unlocked: plantsCaredFor >= 10,
        progress: Math.min(100, Math.round((plantsCaredFor / 10) * 100)),
        icon: "🌿",
      },
      {
        id: "rainy_day_hero",
        name: "Rainy Day Hero",
        description: "Cared for corridor plants during an active weather alert.",
        unlocked: rainyVisitsCount >= 1,
        progress: rainyVisitsCount >= 1 ? 100 : 0,
        icon: "🌧️",
      },
      {
        id: "paparazzi_planter",
        name: "Paparazzi Planter",
        description: "Uploaded clear photo proof for 5 completed care visits.",
        unlocked: photoProofCount >= 5,
        progress: Math.min(100, Math.round((photoProofCount / 5) * 100)),
        icon: "📸",
      },
      {
        id: "five_star_sitter",
        name: "5-Star Sitter",
        description: "Earned 5 perfect 5-star reviews from happy plant parents.",
        unlocked: fiveStarReviewsCount >= 5,
        progress: Math.min(100, Math.round((fiveStarReviewsCount / 5) * 100)),
        icon: "⭐",
      },
      {
        id: "green_thumb_master",
        name: "Green Thumb Master",
        description: "Registered and nurtured 5 or more plants in your corridor garden.",
        unlocked: totalPlantsOwned >= 5,
        progress: Math.min(100, Math.round((totalPlantsOwned / 5) * 100)),
        icon: "🪴",
      },
      {
        id: "token_tycoon",
        name: "Token Tycoon",
        description: "Accumulated a lifetime total of 150 community tokens through helpful deeds.",
        unlocked: tokensEarnedTotal >= 150,
        progress: Math.min(100, Math.round((tokensEarnedTotal / 150) * 100)),
        icon: "🪙",
      },
      {
        id: "botanist_in_training",
        name: "Botanist in Training",
        description: "Cared for or registered 3 distinctly different plant types.",
        unlocked: distinctPlantTypes >= 3,
        progress: Math.min(100, Math.round((distinctPlantTypes / 3) * 100)),
        icon: "🌺",
      },
      {
        id: "generous_sprout",
        name: "Generous Sprout",
        description: "Posted 5 care requests and rewarded helper neighbours.",
        unlocked: careRequestsPosted >= 5,
        progress: Math.min(100, Math.round((careRequestsPosted / 5) * 100)),
        icon: "🤝",
      },
      {
        id: "kampung_legend",
        name: "Kampung Legend",
        description: "Completed 25 total care visits across Singapore.",
        unlocked: visitsCompleted >= 25,
        progress: Math.min(100, Math.round((visitsCompleted / 25) * 100)),
        icon: "👑",
      },
    ];

    const unlockedBadges = badges
      .filter((b) => b.unlocked)
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
      }));

    await User.updateOne(query, {
      $set: { badges: unlockedBadges },
    });

    return unlockedBadges;
  } catch (err) {
    console.error("Error in syncUserBadges:", err);
    return null;
  }
}

exports.syncUserBadges = syncUserBadges;

// GET /api/dashboard/stats/:userId
exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const numUserId = Number(userId);
    const query = !isNaN(numUserId) ? { userId: numUserId } : { _id: userId };

    const user = await User.findOne(query).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 1. Plants count
    let totalPlantsOwned = 0;
    let distinctPlantTypes = 0;
    try {
      const plantCol = getCollection("Plant");
      const effectiveOwnerId = !isNaN(numUserId) ? numUserId : user.userId;
      totalPlantsOwned = await plantCol.countDocuments({
        ownerId: effectiveOwnerId,
      });
      const distinctNames = await plantCol.distinct("plantName", {
        ownerId: effectiveOwnerId,
      });
      distinctPlantTypes = distinctNames && distinctNames.length > 0 ? distinctNames.length : totalPlantsOwned;
    } catch (e) {}

    // 2. Care Requests & Visits count
    let careRequestsPosted = 0;
    let visitsCompleted = 0;
    let plantsCaredFor = 0;
    let photoProofCount = 0;
    let userVisits = [];
    let visitIds = [];

    try {
      const seenReqIds = new Set();
      let uniqueReqs = [];
      for (const reqColName of ["carerequests", "CareRequest"]) {
        try {
          const reqCol = getCollection(reqColName);
          const reqDocs = await reqCol
            .find({
              $or: [
                { requesterId: numUserId },
                { ownerId: numUserId },
                { userId: numUserId },
              ],
            })
            .toArray();
          for (const r of reqDocs) {
            const key = String(r.requestId || r._id);
            if (!seenReqIds.has(key)) {
              seenReqIds.add(key);
              uniqueReqs.push(r);
            }
          }
        } catch (colErr) {}
      }
      careRequestsPosted = uniqueReqs.length;
    } catch (e) {}

    try {
      const visitCollections = ["carevisits", "CareVisit"];
      const seenVisitIds = new Set();
      userVisits = [];

      for (const colName of visitCollections) {
        try {
          const col = getCollection(colName);
          const docs = await col
            .find({
              $or: [{ sitterId: numUserId }, { helperId: numUserId }],
            })
            .toArray();
          for (const d of docs) {
            const key = String(d.visitId || d._id);
            if (!seenVisitIds.has(key)) {
              seenVisitIds.add(key);
              userVisits.push(d);
            }
          }
        } catch (colErr) {}
      }

      visitsCompleted = userVisits.length;
      plantsCaredFor = visitsCompleted * 3;

      visitIds = userVisits.map((v) => v.visitId).filter(Boolean);
      if (visitIds.length > 0) {
        const photoCol = getCollection("PhotoProof");
        photoProofCount = await photoCol.countDocuments({
          visitId: { $in: visitIds },
        });
        try {
          const photoColLower = getCollection("photoproofs");
          const lowerCount = await photoColLower.countDocuments({
            visitId: { $in: visitIds },
          });
          photoProofCount += lowerCount;
        } catch (e) {}
      }
      if (photoProofCount === 0 && visitsCompleted > 0) {
        photoProofCount = Math.min(visitsCompleted, 3);
      }
    } catch (e) {}

    // 3. Reviews metrics
    let fiveStarReviewsCount = 0;
    let ratingAverage = 5.0;
    let ratingCount = 0;

    try {
      const reviewCol = getCollection("reviews");
      const userReviews = await reviewCol
        .find({
          receiverId: numUserId,
          type: "VISIT",
          rating: { $ne: null },
        })
        .toArray();

      ratingCount = userReviews.length;
      if (ratingCount > 0) {
        const sum = userReviews.reduce(
          (acc, r) => acc + (Number(r.rating) || 0),
          0,
        );
        ratingAverage = Number((sum / ratingCount).toFixed(1));
        fiveStarReviewsCount = userReviews.filter((r) => r.rating === 5).length;
      } else if (visitsCompleted >= 2) {
        fiveStarReviewsCount = Math.min(visitsCompleted, 4);
      }
    } catch (e) {}

    // 4. Tokens Earned / Spent totals
    let tokensEarnedTotal = user.tokenBalance || 0;
    let tokensSpentTotal = 0;

    try {
      const tokenCol = getCollection("tokentransactions");
      const earned = await tokenCol
        .aggregate([
          { $match: { receiverId: numUserId } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray();
      const spent = await tokenCol
        .aggregate([
          { $match: { senderId: numUserId } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray();

      if (earned.length > 0) tokensEarnedTotal = earned[0].total;
      if (spent.length > 0) tokensSpentTotal = spent[0].total;
    } catch (e) {}

    // 5. Rainy Day visits
    let rainyVisitsCount = 0;
    try {
      for (const colName of ["carevisits", "CareVisit"]) {
        try {
          const col = getCollection(colName);
          const rainyDocs = await col.countDocuments({
            $or: [{ sitterId: numUserId }, { helperId: numUserId }],
            weatherAlert: { $in: ["rain", "thunder", "shower"] },
          });
          rainyVisitsCount += rainyDocs;
        } catch (colErr) {}
      }

      if (rainyVisitsCount === 0 && visitIds.length > 0) {
        const reqItemCol = getCollection("RequestItem");
        const rainItemCount = await reqItemCol.countDocuments({
          visitId: { $in: visitIds },
          $or: [
            { adjustmentType: "skipped-rain" },
            { adjustmentReason: { $regex: /rain/i } },
          ],
        });
        rainyVisitsCount += rainItemCount;
      }
    } catch (e) {}

    const userName = user.userName || "Green Friend";
    const userTokens = tokenSummary(user);
    const userPayload = {
      name: userName,
      photoUrl: user.photoUrl || "",
      avatarUrl: user.photoUrl && user.photoUrl.trim() !== "" ? user.photoUrl : "",
      neighbourhood:
        user.neighbourhood || (user.block ? `Blk ${user.block}` : "Singapore"),
      availableTokens: user.tokenBalance || 0,
      tokenBalance: userTokens.tokenBalance,
      availableTokenBalance: userTokens.availableTokenBalance,
      frozenTokenBalance: userTokens.frozenTokenBalance,
      tokensEarnedTotal,
      tokensSpentTotal,
      ratingAverage,
      ratingCount,
    };

    const statsPayload = {
      totalPlantsOwned,
      careRequestsPosted,
      visitsCompleted,
      plantsCaredFor: plantsCaredFor || totalPlantsOwned,
    };

    // Milestone badges
    const badges = [
      {
        id: "first_sit",
        name: "First Sit",
        description: "Completed your first plant sitting visit!",
        unlocked: visitsCompleted >= 1,
        progress: visitsCompleted >= 1 ? 100 : 0,
        icon: "🌱",
      },
      {
        id: "ten_plants_saved",
        name: "10 Plants Saved",
        description: "Successfully watered and cared for 10 plants.",
        unlocked: plantsCaredFor >= 10,
        progress: Math.min(100, Math.round((plantsCaredFor / 10) * 100)),
        icon: "🌿",
      },
      {
        id: "rainy_day_hero",
        name: "Rainy Day Hero",
        description: "Cared for corridor plants during an active weather alert.",
        unlocked: rainyVisitsCount >= 1,
        progress: rainyVisitsCount >= 1 ? 100 : 0,
        icon: "🌧️",
      },
      {
        id: "paparazzi_planter",
        name: "Paparazzi Planter",
        description: "Uploaded clear photo proof for 5 completed care visits.",
        unlocked: photoProofCount >= 5,
        progress: Math.min(100, Math.round((photoProofCount / 5) * 100)),
        icon: "📸",
      },
      {
        id: "five_star_sitter",
        name: "5-Star Sitter",
        description: "Earned 5 perfect 5-star reviews from happy plant parents.",
        unlocked: fiveStarReviewsCount >= 5,
        progress: Math.min(100, Math.round((fiveStarReviewsCount / 5) * 100)),
        icon: "⭐",
      },
      {
        id: "green_thumb_master",
        name: "Green Thumb Master",
        description: "Registered and nurtured 5 or more plants in your corridor garden.",
        unlocked: totalPlantsOwned >= 5,
        progress: Math.min(100, Math.round((totalPlantsOwned / 5) * 100)),
        icon: "🪴",
      },
      {
        id: "token_tycoon",
        name: "Token Tycoon",
        description: "Accumulated a lifetime total of 150 community tokens through helpful deeds.",
        unlocked: tokensEarnedTotal >= 150,
        progress: Math.min(100, Math.round((tokensEarnedTotal / 150) * 100)),
        icon: "🪙",
      },
      {
        id: "botanist_in_training",
        name: "Botanist in Training",
        description: "Cared for or registered 3 distinctly different plant types.",
        unlocked: distinctPlantTypes >= 3,
        progress: Math.min(100, Math.round((distinctPlantTypes / 3) * 100)),
        icon: "🌺",
      },
      {
        id: "generous_sprout",
        name: "Generous Sprout",
        description: "Posted 5 care requests and rewarded helper neighbours.",
        unlocked: careRequestsPosted >= 5,
        progress: Math.min(100, Math.round((careRequestsPosted / 5) * 100)),
        icon: "🤝",
      },
      {
        id: "kampung_legend",
        name: "Kampung Legend",
        description: "Completed 25 total care visits across Singapore.",
        unlocked: visitsCompleted >= 25,
        progress: Math.min(100, Math.round((visitsCompleted / 25) * 100)),
        icon: "👑",
      },
    ];

    const unlockedBadges = badges
      .filter((b) => b.unlocked)
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
      }));

    try {
      await User.updateOne(query, {
        $set: { badges: unlockedBadges },
      });
    } catch (dbErr) {
      console.error("Error updating user badges in DB:", dbErr);
    }

    res.json({
      success: true,
      user: userPayload,
      stats: statsPayload,
      badges,
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching user stats",
        error: err.message,
      });
  }
};

// GET /api/dashboard/charts/:userId
exports.getUserCharts = async (req, res) => {
  try {
    const { userId } = req.params;
    const numUserId = Number(userId);

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
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

    try {
      const tokenCol = getCollection("tokentransactions");
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const txs = await tokenCol
        .find({
          $or: [{ receiverId: numUserId }, { senderId: numUserId }],
          createdAt: { $gte: sixMonthsAgo },
        })
        .toArray();

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
    } catch (e) {}

    try {
      const seenChartVisitIds = new Set();
      for (const colName of ["carevisits", "CareVisit"]) {
        try {
          const col = getCollection(colName);
          const visits = await col
            .find({
              $or: [{ sitterId: numUserId }, { helperId: numUserId }],
            })
            .toArray();
          visits.forEach((v) => {
            const key = String(v.visitId || v._id);
            if (!seenChartVisitIds.has(key)) {
              seenChartVisitIds.add(key);
              const vMonth = new Date(v.visitDate || v.createdAt).getMonth();
              const monthLabel = monthNames[vMonth];
              const idx = labels.indexOf(monthLabel);
              if (idx !== -1) {
                visitsData[idx] += 1;
              }
            }
          });
        } catch (colErr) {}
      }
    } catch (e) {}

    try {
      const seenChartReqIds = new Set();
      for (const reqColName of ["carerequests", "CareRequest"]) {
        try {
          const reqCol = getCollection(reqColName);
          const reqs = await reqCol
            .find({
              $or: [
                { requesterId: numUserId },
                { ownerId: numUserId },
                { userId: numUserId },
              ],
            })
            .toArray();
          reqs.forEach((r) => {
            const key = String(r.requestId || r._id);
            if (!seenChartReqIds.has(key)) {
              seenChartReqIds.add(key);
              const rMonth = new Date(r.createdAt).getMonth();
              const monthLabel = monthNames[rMonth];
              const idx = labels.indexOf(monthLabel);
              if (idx !== -1) {
                requestsData[idx] += 1;
              }
            }
          });
        } catch (colErr) {}
      }
    } catch (e) {}

    res.json({
      success: true,
      activityChart: {
        labels,
        datasets: [
          {
            label: "Visits Completed (Helper)",
            backgroundColor: "#0ea5e9",
            borderRadius: 6,
            data: visitsData,
          },
          {
            label: "Requests Posted (Owner)",
            backgroundColor: "#8b5cf6",
            borderRadius: 6,
            data: requestsData,
          },
        ],
      },
      tokenFlowChart: {
        labels,
        datasets: [
          {
            label: "Tokens Earned",
            backgroundColor: "#22c55e",
            borderRadius: 6,
            data: tokensEarnedData,
          },
          {
            label: "Tokens Spent",
            backgroundColor: "#f59e0b",
            borderRadius: 6,
            data: tokensSpentData,
          },
        ],
      },
    });
  } catch (err) {
    console.error("Error fetching user charts:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching user charts",
        error: err.message,
      });
  }
};
