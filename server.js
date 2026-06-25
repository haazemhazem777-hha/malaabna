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
// في server.js — بعد app.listen
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeExpiredBookings() {
  try {
    const now         = new Date();
    const date        = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // حجوزات أيام فاتت
    const old = await prisma.booking.updateMany({
      where: { status: 'upcoming', date: { lt: date } },
      data:  { status: 'completed' },
    });

    // حجوزات النهارده اللي وقتها خلص
    const today = await prisma.booking.updateMany({
      where: { status: 'upcoming', date, endTime: { lte: currentTime } },
      data:  { status: 'completed' },
    });

    if (old.count + today.count > 0)
      console.log(`✅ Cron: حوّل ${old.count + today.count} حجز لمنتهي`);

  } catch (err) {
    console.error('❌ Cron error:', err);
  }
}

// شغّله فوراً عند بدء السيرفر
completeExpiredBookings();

// وكل 5 دقايق
setInterval(completeExpiredBookings, 5 * 60 * 1000);
