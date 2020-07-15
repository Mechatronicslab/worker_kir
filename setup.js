const config = require("./config/config.json");
const mongodbUri = config["database"]["production"]["uri"];
const client = require("mongoose");
const fs = require("fs");
const toJSON = require("plain-text-data-to-json");
var db = client.connection;
const appId = "electron-windows-notifications";
const { ToastNotification } = require("electron-windows-notifications");
const Notification = require("node-mac-notifier");
const rmq = require("amqplib");
var knex = require("knex")({
  client: "mysql",
  connection: {
    host: "localhost",
    user: "root",
    password: "",
    database: "db_kir",
  },
  pool: { min: 0, max: 20 },
});
const options = {
  // useMongoClient: true,
  useNewUrlParser: true,
  autoIndex: false, // Don't build indexes
  // reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  // reconnectInterval: 500, // Reconnect every 500ms
  poolSize: 10, // Maintain up to 10 socket connections
  // If not connected, return errors immediately rather than waiting for reconnect
  // buffemessageaxEntries: 0,
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  useUnifiedTopology: true,
};

function dbConnect() {
  return new Promise((resolve, reject) => {
    client.Promise = global.Promise;
    client.connect(mongodbUri, options, (err, database) => {
      if (err) {
        reject(err);
      } else {
        knex
          .raw("SELECT 'test connection';")
          .then((message) => {
            console.log("mysql connected");
            // Success / boot rest of app
            db = database;
            resolve(knex);
          })
          .catch((err) => {
            // Failure / timeout
            console.log(err);
            reject(err);
          });
        // const knex = require('knex')(mysqlDBconfig);
        // knex.client(mysqlDBconfig)
        // db = database;
        // resolve(database);
      }
    });
  });
}
function rmqConnect() {
  return new Promise(async (resolve, reject) => {
    try {
      let rmqConn = await rmq.connect(config["rmqUri"], function (err, conn) {
        if (err) {
          console.log("[AMQP]", err.message);
          return setTimeout(rmqConnect, 5000);
        }
        conn.on("error", function (err) {
          if (err.message !== "Connection closing") {
            console.error("[AMQP] conn error", err.message);
            return setTimeout(rmqConnect, 5000);
          }
        });
        conn.on("close", function () {
          console.error("[AMQP] reconnecting");
          return setTimeout(rmqConnect, 1000);
        });
      });
      resolve(rmqConn);
    } catch (error) {
      console.log("failed connect to rmq ");
      console.log("try to connect RMQ in 5 sec ..");
      setTimeout(function () {
        rmqConnect();
      }, 5000);
    }
  });
}

function listendata() {
  return new Promise((resolve, reject) => {
    fs.watch("Data", function (event, filename) {
      console.log("Data Baru Masuk= " + filename);
      try {
        var doc = fs.readFileSync("Data/" + filename, "utf8");
        var data1 = toJSON(doc);
        // console.log( JSON.stringify(data1, null, 2) + '\n')
        DataPublish = JSON.stringify(data1, null, 1) + "\n";
        const obj = JSON.parse(DataPublish);
        var Fuel_Type = "Gasoline";

        var CO = obj.CO;
        // console.log(obj.Date);
        var Date = obj.Date;
        // console.log(filename);
        var str = filename.slice(0, -4);
        var No_plate = str;
        // console.log(obj.HC);
        var HC = obj.HC;
        // console.log(obj.O2);
        var O2 = obj.O2;
        // console.log(obj.CO2);
        var CO2 = obj.CO2;
        // console.log(obj.Lambda);
        var Lambda = obj.Lambda;
        // console.log(obj.AFR);
        var AFR = obj.AFR;
        // console.log(obj.NOx);
        var NOx = obj.NOx;
        // console.log(obj.Time);
        var Time = obj.Time;

        var Json = {
          AFR: AFR,
          CO: CO,
          CO2: CO2,
          Date: Date,
          Fuel_Type: Fuel_Type,
          HC: HC,
          Lambda: Lambda,
          NOx: NOx,
          O2: O2,
          No_Plate: No_plate,
          Time: Time,
          Status: "false",
        };
        Simpan(Json);
      } catch (err) {
        console.log("file not found");
      }
    });
  });
}

function Simpan(result) {
  console.log(result);
  db.collection("GasAnalizers").insertOne(result, function (err) {
    if (err) {
      console.log(requestResponse.common_error);
    } else {
      console.log(requestResponse.common_success);
      // import {alert} from 'node-popup';
      const noti = new Notification("Hello from OS X", { body: "It Works!" });
      noti.addEventListener("click", () => console.log("Got a click."));

      // process.end();
      // process.star();
      // close()
    }
  });
}

exports.commonSuccess = () => {
  const data = {
    status: true,
    rc: "0000",
    message: "Berhasil memuat permintaaan",
  };
  return data;
};

const requestResponse = {
  common_nik_not_found: {
    status: false,
    rc: "0000",
    message: "Nik Tidak Terdaftar",
  },
  common_idkab_sudah_terdaftar: {
    status: false,
    rc: "0000",
    message: "Id Kabupaten Sudah Terdaftar",
  },
  common_signin_success: {
    status: true,
    rc: "0000",
    message: "Berhasil memuat permintaaan",
  },
  common_success: {
    status: true,
    rc: "0000",
    message: "Berhasil memuat permintaaan",
  },
  common_nodata: {
    status: false,
    rc: "0000",
    message: "Tidak ada data",
  },
  common_delete: {
    status: true,
    rc: "0000",
    message: "Berhasil menghapus data",
  },
  common_success_simple: {
    status: true,
    rc: "0000",
    message: "Berhasil memuat permintaaan",
  },
  account_not_found: {
    status: false,
    rc: "401",
    message: "Cek kembali username / password anda",
  },
  common_error: {
    status: false,
    rc: "5000",
    message:
      "Server tidak merespon, silahkan hubungi call center untuk info lebih lanjut",
  },
  token_invalid: {
    success: false,
    rc: "0030",
    message: "Akses ditolak! Sesi Anda telah berakhir atau tidak valid",
  },
  email_already_use: {
    status: false,
    rc: "0011",
    message: "Email sudah digunakan",
  },
  phone_number_already_use: {
    status: false,
    rc: "0012",
    message: "Nomor telepon telah digunakan",
  },
  user_already_like: {
    status: true,
    rc: "0013",
    message: "Like",
  },
  invalid_token: {
    status: false,
    rc: "0030",
    message: "Sesi anda telah berakhir, Silahkan login kembali !",
  },
  sudah_ada_data: {
    status: false,
    rc: "0056",
    message: "Sudah ada data",
  },
  gagal_memuat: {
    status: false,
    rc: "0058",
    message: "Gagal Memuat",
  },
  tidak_ada_data: {
    status: false,
    rc: "0058",
    message: "Tidak ada data",
  },
  tidak_ada_data_pupuk: {
    status: false,
    rc: "0058",
    message: "Anda tidak memiliki jatah subsidi",
  },
  nik_sudah_ada: {
    status: false,
    rc: "0105",
    message: "Nik sudah digunakan",
  },
  akun_blm_aktif: {
    status: false,
    rc: "0105",
    message: "Akun anda blm aktif",
  },
  lengkapi_data: {
    status: false,
    rc: "0105",
    message: "Lengkapi data profile anda",
  },
  pembaruan_aplikasi: {
    status: true,
    rc: "0105",
    message: "Untuk kenyamanan penggunaan aplikasi, mohon update aplikasi anda",
  },
  tidak_ada_rekening: {
    status: false,
    rc: "0105",
    message: "Anda Belum memiliki nomor rekening",
  },
  tidak_ada_kios: {
    status: false,
    rc: "0105",
    message: "Anda Belum memiliki kios",
  },
  berhasil_transaksi: {
    status: true,
    rc: "0105",
    message: "Berhasil transaksi",
  },
  tidak_ada_kios: {
    status: false,
    rc: "0105",
    message: "Tidak ada kios didaerah kamu",
  },
};

module.exports = {
  requestResponse,
  mongodbUri,
  dbConnect,
  listendata,
  rmqConnect,
};
