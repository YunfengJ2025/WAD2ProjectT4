// tokenTransactionRoutes.js
const router = require('express').Router();
const controller = require('../controllers/tokenController');

router.post('/', controller.createTokenTran);
router.get('/user/:userId', controller.getTranHistoryByUser);

module.exports = router;
// in server.js: 