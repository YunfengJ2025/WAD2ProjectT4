const multer = require("multer");

const MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Reads the form (multipart/form-data) and keeps an optional "photo" file in
// memory as req.file.buffer. The controller sends it on to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (PHOTO_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error("Photo must be a JPG, PNG or WebP image");
    err.code = "INVALID_TYPE";
    cb(err);
  },
}).single("photo");

// Turns upload errors into { errors: { photo } } responses the form can show
// next to the field.
function uploadPhoto(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();

    let message = "Photo upload failed";
    if (err.code === "LIMIT_FILE_SIZE") message = "Photo must be 2MB or smaller";
    else if (err.code === "INVALID_TYPE") message = err.message;
    else console.log(err);

    res.status(400).json({ message, errors: { photo: message } });
  });
}

module.exports = { uploadPhoto };
