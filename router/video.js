const express = require("express");
const multer = require("multer");
const Video = require("../models/video");
const VideoInsight = require("../models/video_insight");
const UserInsight = require("../models/user_insight");
const Comment = require("../models/comment");
const fs = require("fs");
const router = new express.Router();

//multer storage
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const extension = file.mimetype.split("/")[1];
    const filename = file.fieldname + "-" + req.query.id + "." + extension;

    cb(null, filename);
  },
});

var upload = multer({ storage: storage });

//upload video info
router.post("/api/video", async (req, res) => {
  var body = {
    title: req.body.title,
    group: req.body.group,
    authors: req.body.authors,
    tags: req.body.tags,
  };
  var video = Video(body);
  try {
    await video.save();
    res.status(200).send({
      id: video._id,
      group: video.group,
      title: video.title,
      authors: video.authors,
      tags: video.tags,
    });
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//patch video file info
router.patch("/api/video", async (req, res) => {
  let id = req.body.id;
  try {
    let video = await Video.findById(id);
    video.title = req.body.title;
    video.authors = req.body.authors;
    video.tags = req.body.tags;
    if (!video.rating.users) {
      video.rating = req.body.rating;
    }
    video.splashDuration = req.body.splashDuration;
    video.watermark = req.body.watermark;
    video.chapterMarks = req.body.chapterMarks;
    video.questions = req.body.questions;
    await video.save();
    res.status(200).send();
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//retrieve video by videoTitle
router.get("/api/video/title", async (req, res) => {
  let title = req.query.title;
  try {
    let video = await Video.findOne({ title });
    res.send({ id: video._id });
  } catch (error) {
    res.status(400).send(error);
  }
});

//retrieve video file info
router.get("/api/video", async (req, res) => {
  let id = req.query.id;
  try {
    let video = await Video.findById(id);
    res.status(200).send(video);
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//retrieve video list
router.get("/api/videos", async (req, res) => {
  let group = req.query.group;
  try {
    let videos = await Video.find({ group: group });
    var files = fs.readdirSync("uploads");
    var validFiles = [];

    videos.forEach(async (video) => {
      for (var i in files) {
        if (
          files[i].substr(0, files[i].lastIndexOf(".")) ===
          "splash" + "-" + video._id
        ) {
          validFiles.push(video._id);
        }
      }
    });
    let deleteList = [];
    for (var i = 0; i < videos.length; i++) {
      if (!validFiles.includes(videos[i]._id)) {
        deleteList.push(videos[i]._id);
      }
    }

    const isOld = (filename) => {
      var stats = fs.statSync("uploads/" + filename);
      var mtime = stats.mtime;
      const date1 = new Date(mtime);
      const date2 = Date.now();
      const diffTime = Math.abs(date2 - date1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 2) {
        return true;
      } else {
        return false;
      }
    };

    deleteList.forEach(async (id) => {
      for (var i in files) {
        if (
          files[i].substr(0, files[i].lastIndexOf(".")) ===
          "videoFile" + "-" + id
        ) {
          if (isOld(files[i])) {
            await Video.findByIdAndDelete(id);

            fs.unlink("uploads/" + files[i], function (err) {
              if (err) throw err;
            });
          }
        }
      }
    });

    let modifiedVideo = videos.filter((video) =>
      validFiles.includes(video._id)
    );

    res.status(200).send(modifiedVideo);
  } catch (error) {
    console.log(error.toString());
    res.status(400).send(error.toString());
  }
});

//retrieve videos by name
router.get("/api/video/search", async (req, res) => {
  let key = req.query.key;
  let option = req.query.option;
  let group = req.query.group;

  try {
    let videos = null;
    if (option == "All") {
      videos = await Video.find({
        $and: [
          { group: group },
          {
            $or: [
              { title: { $regex: key, $options: "i" } },
              { tags: { $regex: key, $options: "i" } },
              { authors: { $regex: key, $options: "i" } },
            ],
          },
        ],
      });
    }
    if (option == "Title") {
      videos = await Video.find({
        $and: [{ group: group }, { title: { $regex: key, $options: "i" } }],
      });
    }
    if (option == "Tag") {
      videos = await Video.find({
        $and: [{ group: group }, { tags: { $regex: key, $options: "i" } }],
      });
    }
    if (option == "Author") {
      videos = await Video.find({
        $and: [{ group: group }, { authors: { $regex: key, $options: "i" } }],
      });
    }
    res.status(200).send(videos);
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//upload video splash
router.post("/api/video/splash", upload.single("splash"), async (req, res) => {
  const file = req.file;
  if (!file) {
    const error = new Error("Please upload a file");
    error.httpStatusCode = 400;
    return next(error);
  }
  res.status(200).send();
});

//retrieve video splash
router.get("/api/video/splash", async (req, res) => {
  var id = req.query.id;
  try {
    var files = fs.readdirSync("uploads");
    var imgPath;
    var contentType;
    for (var i in files) {
      if (files[i].substr(0, files[i].lastIndexOf(".")) === "splash-" + id) {
        imgPath = "uploads/" + files[i];
        var splitArray = files[i].split(".");
        contentType = "image/" + splitArray[splitArray.length - 1];
      }
    }
    const img = fs.readFileSync(imgPath);
    res.contentType(contentType);
    res.status(200).send(img);
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//upload video watermark
router.post(
  "/api/video/watermark",
  upload.single("watermark"),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      const error = new Error("Please upload a file");
      error.httpStatusCode = 400;
      return next(error);
    }
    res.status(200).send();
  }
);

//retrieve video watermark
router.get("/api/video/watermark", async (req, res) => {
  var id = req.query.id;
  try {
    var files = fs.readdirSync("uploads");
    var imgPath;
    var contentType;
    for (var i in files) {
      if (files[i].substr(0, files[i].lastIndexOf(".")) === "watermark-" + id) {
        imgPath = "uploads/" + files[i];
        var splitArray = files[i].split(".");
        contentType = "image/" + splitArray[splitArray.length - 1];
      }
    }
    const img = fs.readFileSync(imgPath);
    res.contentType(contentType);
    res.status(200).send(img);
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//delete video file
router.delete("/api/video/file", async (req, res) => {
  let id = req.query.id;
  try {
    await Video.findByIdAndDelete(id);
    var files = fs.readdirSync("uploads");
    let prefixes = ["videoFile", "splash", "watermark"];
    prefixes.forEach((prefix) => {
      for (var i in files) {
        if (
          files[i].substr(0, files[i].lastIndexOf(".")) ===
          prefix + "-" + id
        ) {
          fs.unlink("uploads/" + files[i], function (err) {
            if (err) throw err;
          });
        }
      }
    });
    await VideoInsight.findOneAndDelete({ video: id });
    let doc = await UserInsight.findOne({
      videos: { $elemMatch: { video: id } },
    });
    if (doc) {
      let tempArr = doc.videos.filter((obj) => obj.video != id);
      doc.videos = tempArr;
      doc.save();
    }
    await Comment.findOneAndDelete({ video: id });
    res.status(200).send();
  } catch (error) {
    res.status(400).send(error.toString());
  }
});

//upload video file
router.post("/api/video/file", upload.single("videoFile"), async (req, res) => {
  const file = req.file;
  if (!file) {
    const error = new Error("Please upload a file");
    error.httpStatusCode = 400;
    return next(error);
  }
  res.status(200).send();
});

//retrieve video file
router.get("/api/video/file", async (req, res) => {
  var id = req.query.id;
  var files = fs.readdirSync("uploads");

  var videoPath;
  var contentType;
  for (var i in files) {
    if (files[i].substr(0, files[i].lastIndexOf(".")) === "videoFile-" + id) {
      videoPath = "uploads/" + files[i];
      var splitArray = files[i].split(".");
      contentType = "video/" + splitArray[splitArray.length - 1];
    }
  }
  if (videoPath != null) {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunksize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": contentType,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  }
});
module.exports = router;
