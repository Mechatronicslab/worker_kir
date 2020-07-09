const config = require("./config/config.json");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const logger = require("morgan");
const router = express.Router({ mergeParams: true });
const port = process.env.PORT || 5050;
const path = require("path");
const http = require("http");
const server = http.createServer(app);
const setUp = require("./setup");
const { requestResponse } = require("./setup");
const fs = require("fs");
const RawKir = require("./model/Raw");
const Kendaraan = require("./model/Kendaraan");
const Pengujian = require("./model/Pengujian");
app.use(
  bodyParser.urlencoded({
    enableTypes: ["json", "form"],
    extended: true,
  })
);

app.use(
  bodyParser.json({
    extended: true,
  })
);

app.use(express.static("static"));
app.use("/static", express.static("static"));
app.use(logger("dev"));
//setUp.dbConnect()

app.use("/", router);

server.listen(port);
server.on("listening", onListening);

async function onListening() {
  console.log("try to listen...");
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  setUp
    .dbConnect()
    .then(async (db) => {
      app.database = db;
      console.log("mongodb connected");
      await setUp
        .rmqConnect().then(async (rmq) => {
          console.log("RMQ connected");
          let channel = await rmq.createChannel()
            try {
              await channel.consume("subscribe", async (msg) => {
                console.log("=================================================");
                let data = JSON.parse(msg.content.toString());
                // console.log(msg.content.toString())
                let pengujian = data.pengujian;
                let kendaraan = data.kendaraan;
                decodeImg(pengujian.fotodepansmallfile, pengujian.fotodepansmall);
                decodeImg(
                  pengujian.fotobelakangsmallfile,
                  pengujian.fotobelakangsmall
                );
                decodeImg(pengujian.fotokirismallfile, pengujian.fotokirismall);
                decodeImg(pengujian.fotokanansmallfile, pengujian.fotokanansmall);
               
                delete pengujian.fotodepansmallfile;
                delete pengujian.fotobelakangsmallfile;
                delete pengujian.fotokirismallfile;
                delete pengujian.fotokanansmallfile;
               
                console.log(data);
                await createData(data);
                channel.ack(msg);
                
              });
            }catch (err) {
            console.log(err)
          }
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log("listen failed, try to reconnect in 5 secs...");
      setTimeout(function () {
        onListening();
      }, 5000);
    });
  console.log("Listening on " + bind);
}

function decodeImg(img, filename) {
  try {
    const buff = new Buffer.from(img, "base64");
    fs.writeFileSync("static/" + filename, buff);
  } catch (err) {
    console.log(err);
    onListening();
  }
}

createData = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      await RawKir.create(data);
     
      let datapengujian = Object.assign(data.pengujian, {
        nouji: data.kendaraan.nouji,
        nomesin: data.kendaraan.nomesin,
      });
      // console.log(datapengujian)
      await Pengujian.create(datapengujian);
      await Kendaraan.create(data.kendaraan);
      resolve(true);
    } catch (error) {
      console.log("error insert history");
      reject(error);
    }
  });
};
