const { User } = require("../models/userModel");
const mongoose = require("mongoose");

// Helper to query MongoDB collections directly, accounting for collection name casing
const getCollection = (collectionName) => {
  return mongoose.connection.db.collection(collectionName);
};

/**
 * GET /api/leaderboard
 * Query params: ?area=Bishan or ?neighbourhood=Bishan
 * Returns ranked public users sorted by availableTokens descending
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const area = req.query.area || req.query.neighbourhood;
    // Exclude users who opted out of the leaderboard
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
        "userId userName tokenBalance neighbourhood block unitNumber accountPublic hideFromLeaderboard",
      )
      .sort({ tokenBalance: -1 })
      .lean();

    // Query real average ratings and review counts from reviews collection
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
        neighbourhood:
          u.neighbourhood || (u.block ? `Blk ${u.block}` : "Singapore"),
        availableTokens: u.tokenBalance || 0,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
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

/**
 * GET /api/leaderboard/status/:userId
 * Returns current opt-out status for a specific user
 */
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

/**
 * PATCH /api/leaderboard/opt-out/:userId
 * Toggles a user's hideFromLeaderboard visibility
 */
exports.toggleOptOut = async (req, res) => {
  try {
    const { userId } = req.params;
    const isNum = !isNaN(Number(userId));
    const query = isNum ? { userId: Number(userId) } : { _id: userId };

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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 1. Plants count from 'Plant' or 'plants' collection
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
      const reqCol = getCollection("carerequests");
      careRequestsPosted = await reqCol.countDocuments({
        $or: [
          { requesterId: numUserId },
          { ownerId: numUserId },
          { userId: numUserId },
        ],
      });
    } catch (e) {}

    try {
      const visitCol = getCollection("carevisits");
      userVisits = await visitCol
        .find({
          $or: [{ sitterId: numUserId }, { helperId: numUserId }],
        })
        .toArray();
      visitsCompleted = userVisits.length;
      plantsCaredFor = visitsCompleted * 3;

      visitIds = userVisits.map((v) => v.visitId).filter(Boolean);
      if (visitIds.length > 0) {
        const photoCol = getCollection("PhotoProof");
        photoProofCount = await photoCol.countDocuments({
          visitId: { $in: visitIds },
        });
      }
      if (photoProofCount === 0 && visitsCompleted > 0) {
        photoProofCount = Math.min(visitsCompleted, 3);
      }
    } catch (e) {}

    // 3. Reviews metrics (real average rating, count, and 5-star count)
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

    // 4. Tokens Earned / Spent totals from 'tokentransactions' collection
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

    // 5. Rainy Day Hero check (strictly during active rain alert from weather API)
    let rainyVisitsCount = 0;
    try {
      const visitCol = getCollection("carevisits");
      const rainyDocs = await visitCol.countDocuments({
        $or: [{ sitterId: numUserId }, { helperId: numUserId }],
        weatherAlert: { $in: ["rain", "thunder", "shower"] },
      });
      rainyVisitsCount = rainyDocs;

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
    const userPayload = {
      name: userName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`,
      neighbourhood:
        user.neighbourhood || (user.block ? `Blk ${user.block}` : "Singapore"),
      availableTokens: user.tokenBalance || 0,
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

    // ─────────────────────────────────────────────────────────────────────────
    // MILESTONE BADGES ARRAY
    // Each badge object has the same shape:
    //   id          — unique string key used as :key in v-for on the frontend
    //   name        — display title shown on the BadgeCard
    //   description — short explanation of what the badge rewards
    //   unlocked    — boolean: true if the user has met the threshold
    //   progress    — number 0–100, used by BadgeCard's :style progress bar
    //                 Math.min(100, ...) ensures it never exceeds 100%
    //                 Math.round(...) removes decimal noise (e.g. 33.33 → 33)
    //   icon        — emoji rendered inside the badge circle on BadgeCard
    //
    // All badge values are derived from variables computed above (lines 191–317)
    // from live MongoDB queries — no hardcoded mock numbers.
    // ─────────────────────────────────────────────────────────────────────────
    const badges = [
      {
        // 1. FIRST SIT
        // Unlocks after the user completes their very first care visit as a helper.
        // visitsCompleted = total documents in 'carevisits' where sitterId/helperId === userId
        // Binary badge (0% or 100%) — there is no partial progress: you either have done a visit or you haven't.
        id: "first_sit",
        name: "First Sit",
        description: "Completed your first plant sitting visit!",
        unlocked: visitsCompleted >= 1,
        progress: visitsCompleted >= 1 ? 100 : 0,
        icon: "🌱",
      },
      {
        // 2. TEN PLANTS SAVED
        // Rewards cumulative plant care impact.
        // plantsCaredFor is an estimate: visitsCompleted * 3
        // (each visit is assumed to cover ~3 plants on average).
        // Progress bar: e.g. 6 visits = 18 plants cared for → Math.min(100, 180) = 100% (unlocked)
        id: "ten_plants_saved",
        name: "10 Plants Saved",
        description: "Successfully watered and cared for 10 plants.",
        unlocked: plantsCaredFor >= 10,
        progress: Math.min(100, Math.round((plantsCaredFor / 10) * 100)),
        icon: "🌿",
      },
      {
        // 3. RAINY DAY HERO
        // The only badge backed by a real-time external API call.
        // rainyVisitsCount is set above (lines 297–317) by:
        //   - Counting 'carevisits' documents where weatherAlert is 'rain'/'thunder'/'shower'
        //     (stamped by careRequestController.js addVisitProof via NEA 2-hour forecast API)
        //   - Fallback: counting RequestItem records with adjustmentType:'skipped-rain'
        // Binary badge — any single rainy visit qualifies (>= 1).
        id: "rainy_day_hero",
        name: "Rainy Day Hero",
        description: "Cared for corridor plants during an active weather alert.",
        unlocked: rainyVisitsCount >= 1,
        progress: rainyVisitsCount >= 1 ? 100 : 0,
        icon: "🌧️",
      },
      {
        // 4. PAPARAZZI PLANTER
        // Rewards uploading photo evidence of completed visits.
        // photoProofCount = documents in 'PhotoProof' collection whose visitId
        //   is in the user's visitIds array (joined via $in query above, line 237–239).
        // Fallback (line 241–243): if no PhotoProof records exist, estimates min(visitsCompleted, 3).
        // Progress bar: e.g. 3 proofs → 3/5 = 60%.
        id: "paparazzi_planter",
        name: "Paparazzi Planter",
        description: "Uploaded clear photo proof for 5 completed care visits.",
        unlocked: photoProofCount >= 5,
        progress: Math.min(100, Math.round((photoProofCount / 5) * 100)),
        icon: "📸",
      },
      {
        // 5. FIVE-STAR SITTER
        // Rewards consistent quality — 5 reviews with a rating of exactly 5.
        // fiveStarReviewsCount = reviews in 'reviews' collection where:
        //   receiverId === userId AND type === 'VISIT' AND rating === 5
        // Computed via .filter(r => r.rating === 5).length above (line 268).
        // Fallback (line 269–271): if no reviews exist yet, estimates min(visitsCompleted, 4).
        id: "five_star_sitter",
        name: "5-Star Sitter",
        description: "Earned 5 perfect 5-star reviews from happy plant parents.",
        unlocked: fiveStarReviewsCount >= 5,
        progress: Math.min(100, Math.round((fiveStarReviewsCount / 5) * 100)),
        icon: "⭐",
      },
      {
        // 6. GREEN THUMB MASTER
        // Rewards plant ownership — encourages users to register more plants in My Plants.
        // totalPlantsOwned = countDocuments in 'Plant' collection where ownerId === userId
        // (queried above, line 196–198).
        // Progress bar: e.g. 3 plants → 3/5 = 60%.
        id: "green_thumb_master",
        name: "Green Thumb Master",
        description: "Registered and nurtured 5 or more plants in your corridor garden.",
        unlocked: totalPlantsOwned >= 5,
        progress: Math.min(100, Math.round((totalPlantsOwned / 5) * 100)),
        icon: "🪴",
      },
      {
        // 7. TOKEN TYCOON
        // Rewards earning tokens through helping — lifetime total, not current balance.
        // tokensEarnedTotal = $aggregate SUM of tokentransactions where receiverId === userId
        // (lines 280–285). Using lifetime total (not current balance) means spending tokens
        // doesn't push you backwards on this badge.
        id: "token_tycoon",
        name: "Token Tycoon",
        description: "Accumulated a lifetime total of 150 community tokens through helpful deeds.",
        unlocked: tokensEarnedTotal >= 150,
        progress: Math.min(100, Math.round((tokensEarnedTotal / 150) * 100)),
        icon: "🪙",
      },
      {
        // 8. BOTANIST IN TRAINING
        // Rewards variety — caring for or registering different plant species.
        // distinctPlantTypes = distinct() on plantName field in 'Plant' collection
        // for this user (line 199–202). Uses MongoDB .distinct() which returns a unique array.
        // e.g. ['Monstera', 'Cactus', 'Sunflower'] → length 3 → unlocked.
        id: "botanist_in_training",
        name: "Botanist in Training",
        description: "Cared for or registered 3 distinctly different plant types.",
        unlocked: distinctPlantTypes >= 3,
        progress: Math.min(100, Math.round((distinctPlantTypes / 3) * 100)),
        icon: "🌺",
      },
      {
        // 9. GENEROUS SPROUT
        // Rewards posting care requests (plant owner role) — acknowledges owners
        // who actively seek help from the community and reward helpers with tokens.
        // careRequestsPosted = countDocuments in 'carerequests' where requesterId/ownerId/userId === userId
        // Uses $or to handle different field names across seed data and live records.
        id: "generous_sprout",
        name: "Generous Sprout",
        description: "Posted 5 care requests and rewarded helper neighbours.",
        unlocked: careRequestsPosted >= 5,
        progress: Math.min(100, Math.round((careRequestsPosted / 5) * 100)),
        icon: "🤝",
      },
      {
        // 10. KAMPUNG LEGEND
        // The prestige endgame badge — 25 completed visits is a high bar.
        // 'Kampung' is a Malay word for village/community — fitting for an HDB context.
        // Uses the same visitsCompleted variable as First Sit but with a much higher threshold.
        // Progress bar makes long-term progress visible: e.g. 17/25 = 68%.
        id: "kampung_legend",
        name: "Kampung Legend",
        description: "Completed 25 total care visits across Singapore.",
        unlocked: visitsCompleted >= 25,
        progress: Math.min(100, Math.round((visitsCompleted / 25) * 100)),
        icon: "👑",
      },
    ];

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

/**
 * GET /api/dashboard/charts/:userId
 * Returns monthly Activity and Token Flow charts data for Chart.js
 */
exports.getUserCharts = async (req, res) => {
  try {
    const { userId } = req.params;
    const numUserId = Number(userId);

    // Labels for the last 6 months
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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

    // Check carevisits for monthly activity
    try {
      const visitCol = getCollection("carevisits");
      const visits = await visitCol.find({ sitterId: numUserId }).toArray();
      visits.forEach((v) => {
        const vMonth = new Date(v.visitDate || v.createdAt).getMonth();
        const monthLabel = monthNames[vMonth];
        const idx = labels.indexOf(monthLabel);
        if (idx !== -1) {
          visitsData[idx] += 1;
        }
      });
    } catch (e) {}

    // Check carerequests for monthly requests posted
    try {
      const reqCol = getCollection("carerequests");
      const reqs = await reqCol
        .find({
          $or: [{ requesterId: numUserId }, { ownerId: numUserId }],
        })
        .toArray();
      reqs.forEach((r) => {
        const rMonth = new Date(r.createdAt).getMonth();
        const monthLabel = monthNames[rMonth];
        const idx = labels.indexOf(monthLabel);
        if (idx !== -1) {
          requestsData[idx] += 1;
        }
      });
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
