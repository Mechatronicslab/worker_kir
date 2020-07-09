const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Raw = new Schema({
  kendaraan : JSON , 
  pengujian : JSON 
});

module.exports = mongoose.model("rawkir", Raw);
