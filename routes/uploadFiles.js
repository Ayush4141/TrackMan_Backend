const express = require("express");
const Router = express.Router();
const multer = require("multer");
const fs = require("fs");
const csv = require("csvtojson");
var subsrt = require("subsrt");
const { resourceLimits } = require("worker_threads");
const completeClassv2 = require("./../models/CompleteClassv2");
const everyClassv2 = require("./../models/EveryClassv2");
const everySBVv2 = require("./../models/EverySBVv2.js");
const StopWords = require("./../models/StopWords.js");
const mail = require("./../mailing/mail_server");
const { auth } = require("../utils/authMiddleware");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });
//.single("file");

Router.post("/upload", auth, upload.array("files", 20),  function (req, res, next) {
  try {
    // console.log("hi");
    var fileInfo = req.files;
    // console.log(fileInfo);

    fileInfo.forEach(async (file) => {
        // if ( req.file.mimetype === "application/octet-stream" || req.file.mimetype === "text/csv" || req.file.mimetype === "application/vnd.ms-excel" ){

        

      const extension = file.filename.split(".")[1];
      const fileName = file.filename;

      if (extension === "csv") {
        const st1 = fileName.split(" - Attendance Report.csv");
        const st2 = st1[0];
        const st3 = st2.substring(17, st2.length);
        // console.log(st3);
        var className1 = "";
        completeClassv2
          .find({ fileNames: { $elemMatch: { $eq: st3 } } , teacher: req.user.email })
          .then((classFound11) => {
            //console.log(classFound11);
            className1 = classFound11[0].name;

            const thresholdMins1 = classFound11[0].cutOffMins;
            // console.log(classFound11);
            // console.log(courseId1);
            // console.log(courseId22);
            // if (courseId1 != courseId22) {
            //   console.log("Error in filename");
            //   //return res.status(400).json({ msg: "Error in FileName" });
            //   return res
            //     .status(200)
            //     .json({ status: 400, msg: "Error in FileName" });
            // }

            var studentsData = {
              date: st1[0].split(" ")[0],
              className: className1,
              teacher: req.user.email,
              maxDur: 100,
              thresholdMins: thresholdMins1,
              arrOfStudents: [],
              fileName: fileName,
            };

            const csvFilePath = `./public/${fileName}`;
            csv()
              .fromFile(csvFilePath)
              .then(async (jsonObj) => {
                // const maxDur = jsonObj[jsonObj.length -1].Duration;
                // console.log("MAX DUR");
                // console.log(maxDur);
                const time22 = jsonObj[jsonObj.length - 1].Duration;
                var time33 = 0;
                if (time22.includes("hr")) {
                  const time44 = Number(time22.split("hr")[0]);
                  time33 = time33 + time44 * 60;
                  const time55 = time22.split("hr")[1];
                  const time66 = Number(time55.split("min")[0]);
                  time33 = time33 + time66;
                } else if (time22.includes("min")) {
                  const time77 = Number(time22.split("min")[0]);
                  time33 = time33 + time77;
                } else {
                  time33 = 0;
                }
                const maxDur = time33;
                studentsData.maxDur = maxDur;

                for (let x = 0; x < jsonObj.length; x++) {
                  const firstName1 = jsonObj[x]["First name"];
                  const lastName1 = jsonObj[x]["Last name"];
                  const fullName = firstName1 + " " + lastName1;
                  studentsData.arrOfStudents.push({
                    name: fullName,
                    firstName: firstName1,
                    lastName: lastName1,
                    email: jsonObj[x].Email,
                    duration: jsonObj[x].Duration,
                  });
                }
                //console.log(studentsData);
                await everyClassv2.create(studentsData);
                
                // return res
                //   .status(200)
                //   .json({ status: 200, msg: "Successfully Done" });
              });
              //await axios.get(`http://localhost:4000/api/StudentsData/updateData/:className/:teacher`);
          })
          .catch((error) => {
            console.log("Error in filename");
            return res
              .status(200)
              .json({ status: 400, msg: "Error in FileName" });
          });
      } else if (extension === "sbv") {
        const sbvFilePath = `./public/${fileName}`;
        var content = fs.readFileSync(sbvFilePath, "utf8").toString();
        const content1 = content.split("\n");

        var arr1 = [];
        var arr2 = [];
        const words = await StopWords.find({});
        console.log("hello from sbv");

        for (let x1 = 0; x1 < words.length; x1++) {
          arr2.push(words[x1].wordsStop);
        }

        for (let x = 0; x < content1.length; x++) {
          var ch = content1[x][0];
          if (ch) {
            //console.log(ch);
            var asci = ch.charCodeAt(0);
            if (asci > 64) {
              //arr1.push(content1[x]);

              if (content1[x].includes(":")) {
                // console.log("Here");
                const name1 = content1[x].split(":")[0];
                const mssg = content1[x]
                  .split(":")[1]
                  .trim()
                  .toLocaleLowerCase();
                //console.log(mssg);

                let count1 = 0;
                for (let x2 = 0; x2 < arr2.length; x2++) {
                  if (mssg.includes(arr2[x2])) {
                    count1++;
                  }
                }
                if (count1 == 0) {
                  let count = 0;
                  for (let y = 0; y < arr1.length; y++) {
                    if (arr1[y].name === name1) {
                      count++;
                      arr1[y].comments = arr1[y].comments + 1;
                    }
                  }
                  if (count == 0) {
                    arr1.push({ name: name1, comments: 1 });
                  }
                }
              }
            }
          }
        }

        const name2 = fileName.split(".sbv")[0];
        const name3 = name2.replace("(20", "@20");
        const name4 = name3.split(" @")[0];
        const date1 = name3.split("@")[1].split(" ")[0];

        completeClassv2
          .find({ fileNames: { $elemMatch: { $eq: name4 } } , teacher: req.user.email })
          .then(async (classFound1) => {
            var studentsData = {
              date: date1,
              className: classFound1[0].name,
              teacher: req.user.email,
              arrOfStudents: arr1,
              fileName: fileName,
            };

            await everySBVv2.create(studentsData);
            // return res
            //   .status(200)
            //   .json({ status: 200, msg: "Successfully Done" });
          })
          .catch((error) => {
            console.log("Error in filename");
            return res
              .status(200)
              .json({ status: 400, msg: "Error in FileName" });
          });
      }
    });

    res.status(200).json({ msg: "Success" });
    // console.log(req.files,req.file);
    // upload(req,res,err=>{
    //     if (err) {
    //     return res.status(500).json(err);
    //   }
    //   console.log(req.files,req.file)
    // })
    // upload(req, res, (err) => {
    //   if (err) {
    //     return res.status(500).json(err);
    //   }
    //   console.log(req.file);
    //   if (
    //     req.file.mimetype === "application/octet-stream" ||
    //     req.file.mimetype === "text/csv" ||
    //     req.file.mimetype === "application/vnd.ms-excel"
    //   ) {
    //     console.log(req.file);
    //     return res.status(200).send(req.file);
    //   } else {
    //     console.log("ERROR HERE");
    //     return res.status(400).json({ msg: "Unsuitable file type" });
    //   }
    // });
    
  } catch (error) {
    mail.mailfunc("Error in /upload", error.toString());
    next(error);
  }
});



Router.get( "/deleteEveryClassv2/:courseName/:fileId", auth,async (req, res, next) => {
    try {
      console.log("API is called");
      everyClassv2.findByIdAndRemove(req.params.fileId, function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          console.log(docs);
        }
      });
      res.status(200).json({ msg: "Deleted", status: 200 });

    } catch (error) {
      mail.mailfunc("Error in /deleteEveryClassv2/:courseName/:fileId", error.toString());
      next(error);
    }
  }
);

Router.get("/deleteEveryClassSbv/:courseName/:fileId", auth, async (req, res, next) => {
  try {
      everySBVv2.findByIdAndRemove(req.params.fileId, function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          console.log(docs);
        }
      });
      res.status(200).json({ msg: "Deleted", status: 200 });

    } catch (error) {
      mail.mailfunc("Error in /deleteEveryClassSbv/:courseName/:fileId", error.toString());
      next(error);
    }
  
});

Router.post("/readForwardedMails", async (req, res, next) => {
  try {
    const data = req.body;
    const ReceivedSECRETKey = data.APIKEY;
    const SECRET_KEY = process.env.RECEIVE_EMAIL_SECRET_KEY
    if(SECRET_KEY != ReceivedSECRETKey) {
      res.status(400).json({msg: "INVALID SECRET KEY", status: 400})
    } else {
      const filepath = data.filepath;
      const teacherEmail = data.teacherEmail;
      console.log(filepath, " ", teacherEmail)
      res.status(200).json({msg: "Request Submitted", status: 200})
    }
  } catch(error) {
    res.status(200).json({msg: "Some Error Occured", status: 400})
    next(error);
  }
});

module.exports = Router;
