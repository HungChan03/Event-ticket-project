// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // MongoDB local connection string - Force IPv4
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/event-ticket-db';
 
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increase timeout to 10s
      connectTimeoutMS: 10000,
      socketTimeoutMS: 10000
    });
    
    
  } catch (error) {
  
    process.exit(1);
  }
};

module.exports = connectDB;
