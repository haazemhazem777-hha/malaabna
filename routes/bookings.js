const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// Middleware — التحقق من الـ Token
// ============================================
function protect(req, res, next) {
  const token = (req.headers["authorization"] || "").split(" ")[1];
  if (!token) return res.status(401).json({ error: "لازم تسجل دخول الأول" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "الـ token غلط أو انتهت صلاحيته" });
  }
}

// ============================================
// Helper — حساب endTime
// مثال: startTime="10:00", duration=2 → "12:00"
// ============================================
function calcEndTime(startTime, duration) {
  const [h, m] = startTime.split(":").map(Number);
  const endH = h + duration;
  return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================
// Helper — هل الوقت في الماضي؟
// ============================================
function isInPast(date, time) {
  const now = new Date();
  const slot = new Date(`${date}T${time}:00`);
  return slot <= now;
}

// ============================================
// GET /api/bookings/fields — كل الملاعب
// ============================================
router.get("/fields", async (req, res) => {
  try {
    const fields = await prisma.field.findMany();
    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// GET /api/bookings/slots/:fieldId?date=YYYY-MM-DD
// يرجع الـ slots المتاحة والمحجوزة لملعب معين في يوم معين
// ============================================
router.get("/slots/:fieldId", async (req, res) => {
  try {
    const fieldId = parseInt(req.params.fieldId);
    const { date } = req.query;

    if (!date) return res.status(400).json({ error: "التاريخ مطلوب" });

    // جيب بيانات الملعب (openTime, closeTime)
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) return res.status(404).json({ error: "الملعب مش موجود" });

    // جيب كل الحجوزات الفعّالة في اليوم ده
    const bookings = await prisma.booking.findMany({
      where: {
        fieldId,
        date,
        status: { in: ["upcoming"] },
      },
      select: { time: true, endTime: true, duration: true },
    });

    // ابني قايمة الـ slots من openTime لـ closeTime
    const slots = [];
    for (let h = field.openTime; h < field.closeTime; h++) {
      const time = `${String(h).padStart(2, "0")}:00`;
      const timeEnd = `${String(h + 1).padStart(2, "0")}:00`;

      // هل الوقت ده محجوز؟ (يعني جوه أي حجز موجود)
      const isBooked = bookings.some((b) => {
        return time >= b.time && time < b.endTime;
      });

      // هل الوقت ده في الماضي؟
      const isPast = isInPast(date, time);

      slots.push({
        time,
        timeEnd,
        hour: h,
        available: !isBooked && !isPast,
        booked: isBooked,
        past: isPast,
      });
    }

    res.json({ field, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// GET /api/bookings — حجوزات المستخدم
// ============================================
router.get("/", protect, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { field: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// POST /api/bookings — حجز جديد
// ============================================
router.post("/", protect, async (req, res) => {
  try {
    const { fieldId, date, time, duration = 1 } = req.body;

    if (!fieldId || !date || !time)
      return res.status(400).json({ error: "البيانات ناقصة" });

    // 1. منع حجز وقت في الماضي
    if (isInPast(date, time))
      return res.status(400).json({ error: "مش ممكن تحجز وقت في الماضي" });

    // 2. جيب الملعب وتأكد إنه موجود
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) return res.status(404).json({ error: "الملعب مش موجود" });

    // 3. تأكد إن الوقت جوه أوقات عمل الملعب
    const startHour = parseInt(time.split(":")[0]);
    const endHour = startHour + duration;
    if (startHour < field.openTime || endHour > field.closeTime)
      return res.status(400).json({
        error: `الملعب بيفتح ${field.openTime}:00 ويقفل ${field.closeTime}:00`,
      });

    // 4. حساب endTime
    const endTime = calcEndTime(time, duration);

    // 5. تأكد إن مفيش تعارض مع حجوزات موجودة
    // أي حجز موجود تاريخه ووقته يتداخل مع الحجز الجديد
    const conflict = await prisma.booking.findFirst({
      where: {
        fieldId,
        date,
        status: "upcoming",
        AND: [
          { time: { lt: endTime } }, // الحجز الموجود يبدأ قبل ما الجديد ينتهي
          { endTime: { gt: time } }, // الحجز الموجود ينتهي بعد ما الجديد يبدأ
        ],
      },
    });
    if (conflict)
      return res
        .status(400)
        .json({ error: "الوقت ده أو جزء منه محجوز بالفعل" });

    // 6. احسب السعر الكلي
    const totalPrice = field.price * duration;

    // 7. اعمل الحجز
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        fieldId,
        date,
        time,
        endTime,
        duration,
        price: totalPrice,
        status: "upcoming",
      },
      include: { field: true },
    });

    res.status(201).json({ message: "✅ تم الحجز بنجاح!", booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// PATCH /api/bookings/:id/cancel — إلغاء حجز
// ============================================
router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user.id },
    });

    if (!booking) return res.status(404).json({ error: "الحجز مش موجود" });

    if (booking.status !== "upcoming")
      return res.status(400).json({ error: "الحجز ده مش ممكن يتلغى" });

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
    });

    res.json({
      message: "✅ تم إلغاء الحجز — الوقت أصبح متاحاً للجميع",
      booking: updated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// POST /api/bookings/complete — Cron Job
// يحول الحجوزات المنتهية من upcoming لـ completed
// ============================================
router.post("/complete", async (req, res) => {
  try {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // حوّل الحجوزات اللي تاريخها أقدم من النهارده
    const oldResult = await prisma.booking.updateMany({
      where: {
        status: "upcoming",
        date: { lt: date },
      },
      data: { status: "completed" },
    });

    // حوّل الحجوزات اللي في نفس اليوم لكن وقتها خلص
    const todayResult = await prisma.booking.updateMany({
      where: {
        status: "upcoming",
        date,
        endTime: { lte: currentTime },
      },
      data: { status: "completed" },
    });

    const total = oldResult.count + todayResult.count;
    res.json({ message: `✅ تم تحويل ${total} حجز لمنتهي` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ" });
  }
});

module.exports = router;
