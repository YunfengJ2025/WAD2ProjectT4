const { createImageUpload } = require("./imageUpload");

// Single optional profile/plant photo; proof uploads retain per-plant field names.
const upload = createImageUpload({ files: 1 }).single("photo");
const uploadPhotos = createImageUpload().any();

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

function uploadPlantPhotos(req, res, next) {
  uploadPhotos(req, res, (err) => {
    if (!err) return next();
    let message = "Photo upload failed";
    if (err.code === "LIMIT_FILE_SIZE") message = "Each photo must be 2MB or smaller";
    else if (err.code === "INVALID_TYPE") message = err.message;
    else console.log(err);
    res.status(400).json({ message, errors: { photos: message } });
  });
}

module.exports = { uploadPhoto, uploadPlantPhotos };
