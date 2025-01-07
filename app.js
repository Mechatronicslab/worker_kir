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
const dataUji = require("./model/datauji");
const baseDir = "static/";
const sharp = require("sharp");
const dateFormat = require('dateformat');
const axios = require('axios');
const url = "http://kir-tanggamus-api.psti-ubl.id/static/"
app.use(
  bodyParser.urlencoded({
    enableTypes: ["json", "form"],
    extended: true,
  })
);

app.use(bodyParser.json({ extended: true }));

app.use(express.static("static"));
app.use("/static", express.static("static"));
app.use(logger("dev"));
//setUp.dbConnect()

app.use("/", router);

server.listen(port);
server.on("listening", onListening);

async function onListening() {
  console.log("try to listen...");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  setUp
    .dbConnect()
    .then(async (dbMysql) => {
      app.database = dbMysql;
      console.log("mongodb connected");
      await setUp
        .rmqConnect()
        .then(async (rmq) => {
          console.log("RMQ connected");
          let channel = await rmq.createChannel();
          try {
            await channel.consume("kir", async (msg) => {
              console.log("=================================================");
              let data = JSON.parse(msg.content.toString());
              let pengujian = data.pengujian;
              let kendaraan = data.kendaraan;
              // await decodeImg(pengujian.fotodepansmallfile, pengujian.fotodepansmall);
              // await decodeImg(
              //   pengujian.fotobelakangsmallfile,
              //   pengujian.fotobelakangsmall
              // );
              // await decodeImg(pengujian.fotokirismallfile, pengujian.fotokirismall);
              // await decodeImg(pengujian.fotokanansmallfile, pengujian.fotokanansmall);
              delete pengujian._id;
              delete pengujian.__v;
              delete pengujian.fotodepansmallfile;
              delete pengujian.fotobelakangsmallfile;
              delete pengujian.fotokirismallfile;
              delete pengujian.fotokanansmallfile;
              delete pengujian.denda ;
              // console.log(data);
              await createData(data);

              channel.ack(msg);
            });
          } catch (err) {
            // return channel;
            console.log(err);
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
    sharp(buff)
      .resize(600, 600)
      .toFile(baseDir + filename, (err, info) => {
        if (err) {
          console.log(err);
        } else {
          console.log("berhasil convert gambar");
        }
      });
  } catch (err) {
    console.log(err);
    // onListening();
  }
}

createData = (data) => {
  return new Promise(async (resolve, reject) => {
    // console.log(data.pengujian.tgluji)
    // console.log(data.pengujian.masaberlakuuji)
    try {


      await RawKir.create(data)
        .then((result) => {
          console.log("insert Data Raw Success");
        })
        .catch((err) => {
          console.log("gagal input data raw :" + err);
        });

      let datapengujian = Object.assign(data.pengujian, {
        nouji: data.kendaraan.nouji,
        nomesin: data.kendaraan.nomesin,
      });
      // console.log(datapengujian)
      await Pengujian.create(datapengujian)
        .then((result) => {
          console.log("insert Data Pengujian Success");
        })
        .catch((err) => {
          console.log("gagal input data pengujian :" + err);
        });
      await Kendaraan.updateOne(
        { nouji: data.kendaraan.nouji },
        data.kendaraan,
        {
          upsert: true,
        }
      )
        .then((result) => {
          console.log("insert Data Kendaraan Success");
        })
        .catch((err) => {
          console.log("gagal input data kendaraan :" + err);
        });
      await storeMysql(data)
        .then(async (result) => {
          console.log("selesai")
          // dataUji
          //   .deleteOne({ nouji: data.kendaraan.nouji })
          //   .then(async (result) => {
          //     console.log("Proses selesai");
          //   })
          //   .catch((err) => {
          //     console.log("gagal Hapus data :" + err);
          //   });
        })
        .catch((err) => {
          console.log("gagal input data kendaraan :" + err);
        });

      resolve(true);
    } catch (error) {
      console.log("error insert history" + error);
      reject(error);
    }
  });
};

storeMysql = (data) => {
  return new Promise(async (resolve, reject) => {

    let value = Object.assign(data.pengujian, data.kendaraan);
    let tgluji = new Date(value.tgluji);
    let tglsertifikatreg = new Date(value.tglsertifikatreg);
    let masaberlakuuji = new Date(value.masaberlakuuji);
    value.tgluji = dateFormat(tgluji, "ddmmyyyy")
    value.tglsertifikatreg = dateFormat(tglsertifikatreg, "ddmmyyyy")
    value.masaberlakuuji = dateFormat(masaberlakuuji, "ddmmyyyy")
    value.idpetugasuji = 651;
    value.idkepaladinas = 687;
    value.iddirektur = 19;
    let fotodepan = value.fotodepansmall
    let fotobelakang = value.fotobelakangsmall
    let fotokanan = value.fotokanansmall
    let fotokiri = value.fotokirismall
    value.fotodepansmall = null;
    value.fotobelakangsmall = null;
    value.fotokanansmall = null;
    value.fotokirismall = null;

    // value.tglsertifikatreg = 20200713; value.tgluji = 20200713;
    delete value.bahankaroseri;
    delete value.banyaktempatberdiri;
    delete value.banyaktempatduduk;
    delete value.jeniskaroseri;
    delete value.warnatnbk;
    delete value.idAdministrasi;
    delete value.total;
    delete value.__v;
    delete value._id;
    delete value.created_at;
    delete value.$setOnInsert;
    delete value.no_plat;
    delete value.deleted;
    delete value.no_surat_numpanguji;
    delete value.no_surat_ket_mutasi;
    delete value.tglsurat;
    console.log(value);

    await axios.get(url + fotodepan, { responseType: 'arraybuffer' })
      .then(res => {
        let data = Buffer.from(res.data, 'binary').toString('base64')
        decodeImg(data, fotodepan)
      })

    await axios.get(url + fotobelakang, { responseType: 'arraybuffer' })
      .then(res => {
        let data = Buffer.from(res.data, 'binary').toString('base64')
        decodeImg(data, fotobelakang)
      })

    await axios.get(url + fotokanan, { responseType: 'arraybuffer' })
      .then(res => {
        let data = Buffer.from(res.data, 'binary').toString('base64')
        decodeImg(data, fotokanan)
      })

    await axios.get(url + fotokiri, { responseType: 'arraybuffer' })
      .then(res => {
        let data = Buffer.from(res.data, 'binary').toString('base64')
        decodeImg(data, fotokiri)
      })
    app
      .database("datapengujian")
      .insert(value)
      .then(() => {
        app
          .database("fotomentah")
          .insert({
            nouji: value.nouji,
            fotodepanmentah: fs.readFileSync(baseDir + fotodepan),
            fotobelakangmentah: fs.readFileSync(
              baseDir + fotobelakang
            ),
            fotokananmentah: fs.readFileSync(baseDir + fotokanan),
            fotokirimentah: fs.readFileSync(baseDir + fotokiri),
          })
          .then(() => {
            console.log("Data Berhasil tersimpan");
            try {
              fs.unlinkSync(baseDir + fotodepan)
              fs.unlinkSync(baseDir + fotobelakang)
              fs.unlinkSync(baseDir + fotokanan)
              fs.unlinkSync(baseDir + fotokiri)
            } catch (err) {
              console.error(err)
            }
            resolve(true);
          })
          .catch((err) => {
            console.log(err);
            reject(err);
          });
        // resolve(true);
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
};
