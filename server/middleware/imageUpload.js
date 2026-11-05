const multer = require("multer");

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

// Share validation while callers keep their field names and file-count limits.
function createImageUpload(limits = {}, invalidTypeMessage = "Photo must be a JPG, PNG or WebP image") {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, ...limits },
    fileFilter(req, file, cb) {
      if (PHOTO_TYPES.includes(file.mimetype)) return cb(null, true);
      const error = new Error(invalidTypeMessage);
      error.code = "INVALID_TYPE";
      cb(error);
    },
  });
}

module.exports = { createImageUpload };
