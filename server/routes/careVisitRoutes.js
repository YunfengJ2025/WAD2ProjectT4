const express = require("express");
const requireUser = require("../middleware/requireUser");
const { uploadPlantPhotos } = require("../middleware/uploadPhoto");
const controller = require("../controllers/careVisitController");
const router = express.Router();
router.use(requireUser);
router.get("/", controller.myVisits);
router.get("/available", controller.availableVisits);
router.get("/assignments", controller.myAssignments);
// Keep replacement visit requests with the other visit operations.
router.post("/make-up/:visitId", controller.makeUpRequest);
router.post("/:visitId/accept", controller.acceptVisit);
// Allow an accepted sitter to release a visit under the cutoff/penalty policy.
router.post("/:visitId/opt-out", controller.optOutVisit);
router.post("/:visitId/proof", uploadPlantPhotos, controller.addVisitProof);
module.exports = router;
