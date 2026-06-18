require("dotenv").config();
const cors = require("cors");

const express = require("express");
const app = express();

app.use(cors());

const authRoutes = require("./routes/auth");
const bookingRoutes = require("./routes/bookings");
const ratingRoutes = require("./routes/ratings");

app.use(express.json());
app.use(express.static("public"));

// app.get("/", (req, res) => {
//   res.json({
//     message: "🌐 سيرفر ملاعبنا شغال!",
//   });
// });

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ratings", ratingRoutes);

app.listen(3000, () => {
  console.log("✅ السيرفر شغال على http://localhost:3000");
});
