const { v2: cloudinary } = require("cloudinary");

// Pass one of these to uploadImage so each kind of photo gets its own folder.
// Cloudinary creates a folder the first time something is uploaded to it.
const FOLDERS = {
  plants: "plant-sitting/plants",
  userIcon: "plant-sitting/userIcon",
  postImage: "plant-sitting/postImage",
  shopImage: "plant-sitting/shopImage",
};

// Reads CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
function configure() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  if (!cloudinary.config().cloud_name) {
    const err = new Error("Photo uploads aren't set up yet (Cloudinary keys missing in .env)");
    err.status = 500;
    throw err;
  }
}

// Uploads an in-memory file (multer memoryStorage) and returns { url, publicId }.
// folder defaults to plants so existing plant code keeps working.
async function uploadImage(buffer, folder = FOLDERS.plants) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Shrinks big phone photos; cards never show them larger than this.
        transformation: [{ width: 1200, height: 1200, crop: "limit" }],
      },
      (err, result) => {
        if (err) {
          console.log("Cloudinary upload failed:", err.message);
          const friendly = new Error("Couldn't upload the photo. Please try again.");
          friendly.status = 502;
          return reject(friendly);
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

// Best effort: a failed delete only leaves an unused image behind.
async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.log("Cloudinary delete failed:", err.message);
  }
}

module.exports = { uploadImage, deleteImage, FOLDERS };
