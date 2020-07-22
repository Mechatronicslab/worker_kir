const config = require("./config/config.json");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const logger = require("morgan");
const router = express.Router({mergeParams: true});
const port = process.env.PORT || 5050;
const path = require("path");
const http = require("http");
const server = http.createServer(app);
const setUp = require("./setup");
const {requestResponse} = require("./setup");
const fs = require("fs");
const RawKir = require("./model/Raw");
const Kendaraan = require("./model/Kendaraan");
const Pengujian = require("./model/Pengujian");
const dataUji = require("./model/datauji");
app.use(bodyParser.urlencoded({
    enableTypes: [
        "json", "form"
    ],
    extended: true
}));

app.use(bodyParser.json({extended: true}));

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
    var bind = typeof addr === "string"
        ? "pipe " + addr
        : "port " + addr.port;
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
                            decodeImg(pengujian.fotodepansmallfile, pengujian.jkj);
                            decodeImg(pengujian.fotobelakangsmallfile, pengujian.fotobelakangsmall);
                            decodeImg(pengujian.fotokirismallfile, pengujian.fotokirismall);
                            decodeImg(pengujian.fotokanansmallfile, pengujian.fotokanansmall);
                            delete pengujian._id
                            delete pengujian.__v
                            delete pengujian.fotodepansmallfile
                            delete pengujian.fotobelakangsmallfile
                            delete pengujian.fotokirismallfile
                            delete pengujian.fotokanansmallfile
                           

                            console.log(data);
                            await createData(data);
                            channel.ack(msg);

                        });
                    } catch (err) {
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
        fs.writeFileSync("static/" + filename, buff);
    } catch (err) {
        console.log(err);
        onListening();
    }
}

createData = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            await RawKir
                .create(data)
                .then((result) => {
                    console.log("insert Data Raw Success");
                })
                .catch((err) => {
                    console.log("gagal input data raw :" + err);
                });

            let datapengujian = Object.assign(data.pengujian, {
                nouji: data.kendaraan.nouji,
                nomesin: data.kendaraan.nomesin
            });
            // console.log(datapengujian)
            await Pengujian
                .create(datapengujian)
                .then((result) => {
                    console.log("insert Data Pengujian Success");
                })
                .catch((err) => {
                    console.log("gagal input data pengujian :" + err);
                });
            await Kendaraan
                .update({nouji : data.kendaraan.nouji},data.kendaraan, {upsert: true})
                .then((result) => {
                    console.log("insert Data Kendaraan Success");
                })
                .catch((err) => {
                    console.log("gagal input data kendaraan :" + err);
                });
            await storeMysql(data)
                .then(async (result) => {
                    dataUji
                        .deleteOne({nouji: data.kendaraan.nouji})
                        .then(async (result) => {
                            console.log(data.kendaraan.nouji);
                            console.log("Proses selesai")
                        })
                        .catch((err) => {
                            console.log("gagal Hapus data :" + err);
                        });
                    
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
        // value.tglsertifikatreg = value     .tglsertifikatreg     .replace("-", "");
        let tgluji = new Date(value.tgluji)
        let tglsertifikatreg = new Date(value.tglsertifikatreg)
        value.tgluji = tgluji
            .toLocaleDateString('en-US')
            .replace(/\//g, "")
        value.tglsertifikatreg = tglsertifikatreg
            .toLocaleDateString('en-US')
            .replace(/\//g, "")
        console.log(value.tglsertifikatreg)
        console.log(value.tgluji)
        // value.tglsertifikatreg = 20200713; value.tgluji = 20200713;
        delete value.bahankaroseri;
        delete value.banyaktempatberdiri;
        delete value.banyaktempatduduk;
        delete value.jeniskaroseri;
        delete value.warnatnbk;
        delete value.idAdministrasi
        delete value.total
        delete value.__v
        delete value._id
        delete value.created_at
        delete value.no_plat
        delete value.deleted
        console.log(value)
        app
            .database("datapengujian")
            .insert(value)
            .then((message) => {
                console.log("mysql  tester knex connected");
                resolve(true);
            })
            .catch((err) => {
                console.log(err);
                reject(err);
            });
    });
};
