const {
  AWS_BUCKET_NAME,
  AWS_SECRET,
  AWS_ACCESS_KEY,
} = require("../secrets.js");
const { S3Client } = require("@aws-sdk/client-s3");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");
const User = require("../Models/User.js");

const getPresignedUrl = async (req, res) => {
  const filename = req.query.filename;
  const filetype = req.query.filetype;

  if (!filename || !filetype) {
    return res
      .status(400)
      .json({ error: "Filename and filetype are required" });
  }

  if (!filetype.startsWith("image/")) {
    return res.status(400).json({ error: "Invalid file type" });
  }

  const userId = req.user.id;
  const s3Client = new S3Client({
    credentials: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET,
    },
    region: "ap-south-1",
  });

  try {
    const { url, fields } = await createPresignedPost(s3Client, {
      Bucket: AWS_BUCKET_NAME,
      Key: `conversa/${userId}/${Math.random()}/${filename}`,
      Conditions: [["content-length-range", 0, 5 * 1024 * 1024]],
      Fields: {
        success_action_status: "201",
      },
      Expires: 15 * 60,
    });

    return res.status(200).json({ url, fields });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getOnlineStatus = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ isOnline: user.isOnline });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { getPresignedUrl, getOnlineStatus };
