const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in environment variables. Check your .env file.");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const eventRoutes = require("./routes/eventRoutes");
const orderRoutes = require("./routes/orderRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const userRoutes = require("./routes/usersRoutes");
const venueRoutes = require("./routes/venueRoutes");

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/venues", venueRoutes);

// Swagger UI - auto-generate basic OpenAPI spec from route files
try {
  const swaggerUi = require('swagger-ui-express');
  const { buildSpec } = require('./utils/swaggerGenerator');
  const swaggerSpec = buildSpec();
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    // expose raw spec for debugging/inspection
    app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
} catch (err) {
  console.error('Failed to setup Swagger UI:', err.message);
}

app.get("/", (req, res) => res.send("API is running..."));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
