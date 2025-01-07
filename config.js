require('dotenv').config()
module.exports = {
  amqpUrl: `amqp://${process.env.RMQ_USER}:${process.env.RMQ_PASS}@${process.env.RMQ_HOST}:${process.env.RMQ_PORT}/${process.env.RMQ_VHOST}?heartbeat=60`,
  // mongoUrl: `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  mongoUrl: `mongodb://127.0.0.1:27017/reporting_apps`,
  mongoOptions: {
    keepAlive: true,
    maxPoolSize: 10, // don't use max^* if !useUnifiedTopology
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
}
