// tokenTransactionRoutes.js
const router = require('express').Router();
const controller = require('../controllers/tokenController');

router.post("/", controller.createTokenTran);
router.get("/", controller.getAllTokenTran);
router.get("/user/:userId", controller.getTranHistoryByUser);
router.get("/type/:type", controller.getTranByType);

module.exports = router;


module.exports = router;
// in server.js: 