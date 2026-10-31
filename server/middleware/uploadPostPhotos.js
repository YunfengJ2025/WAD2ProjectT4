const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 9, fields: 5 },
  fileFilter(req, file, cb) {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
      return cb(null, true);
    cb(new Error("Photos must be JPG, PNG or WebP images"));
  },
}).array("photos", 9);
module.exports = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each photo must be 2MB or smaller"
        : ["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(err.code)
          ? "Upload up to 9 photos using the photos field"
          : err.message;
    return res.status(400).json({ message });
  });
