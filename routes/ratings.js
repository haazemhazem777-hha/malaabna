// ============================================
// routes/ratings.js — التقييمات مع Prisma
// ============================================

const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// Middleware — التحقق من الـ Token
// ============================================
function protect(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "لازم تسجل دخول الأول" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "الـ token غلط أو انتهت صلاحيته" });
  }
}

// ============================================
// GET /api/ratings/matches — المباريات المنتهية اللي ممكن أقيّم فيها
// ============================================
router.get("/matches/mine", protect, async (req, res) => {
  try {
    // جيب كل الحجوزات المنتهية بتاعتي
    const myBookings = await prisma.booking.findMany({
      where: { userId: req.user.id, status: "completed" },
      include: { field: true },
      orderBy: { date: "desc" },
    });

    // لكل حجز، جيب اللاعبين الآخرين اللي حجزوا نفس الملعب في نفس اليوم والوقت
    const matches = await Promise.all(
      myBookings.map(async (b) => {
        const samePlayers = await prisma.booking.findMany({
          where: {
            fieldId: b.fieldId,
            date: b.date,
            time: b.time,
            userId: { not: req.user.id }, // غير نفسي
          },
          include: { user: { select: { id: true, name: true } } },
        });

        // هل قيّمت كل لاعبي المباراة دي قبل كده؟
        const myRatingsForBooking = await prisma.rating.findMany({
          where: { raterId: req.user.id, bookingId: b.id },
        });

        return {
          bookingId: b.id,
          date: b.date,
          time: b.time,
          field: b.field,
          players: samePlayers.map((p) => p.user),
          rated:
            myRatingsForBooking.length > 0 &&
            myRatingsForBooking.length >= samePlayers.length,
        };
      }),
    );

    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// POST /api/ratings — عمل تقييم جديد
// ============================================
router.post("/", protect, async (req, res) => {
  try {
    const { ratedId, bookingId, stars, comment, skills } = req.body;

    // تحقق من البيانات
    if (!ratedId || !bookingId || !stars)
      return res.status(400).json({ error: "البيانات ناقصة" });

    if (stars < 1 || stars > 5)
      return res.status(400).json({ error: "التقييم لازم يكون من 1 لـ 5" });

    // متقدرش تقيّم نفسك
    if (ratedId === req.user.id)
      return res.status(400).json({ error: "مش ممكن تقيّم نفسك!" });

    // تأكد إن الحجز موجود
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return res.status(404).json({ error: "المباراة مش موجودة" });

    // تأكد إن المستخدم ده ماقيّمش اللاعب ده في نفس المباراة قبل كده
    const exists = await prisma.rating.findFirst({
      where: { raterId: req.user.id, ratedId, bookingId },
    });
    if (exists)
      return res
        .status(400)
        .json({ error: "قيّمت اللاعب ده قبل كده في نفس المباراة" });

    // عمل التقييم
    const rating = await prisma.rating.create({
      data: {
        raterId: req.user.id,
        ratedId,
        bookingId,
        stars,
        comment: comment || null,
        skills: skills || [],
      },
      include: {
        rater: { select: { id: true, name: true } },
        rated: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ message: "✅ تم التقييم بنجاح!", rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// GET /api/ratings/:userId — جيب تقييمات لاعب معين
// ============================================
router.get("/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const ratings = await prisma.rating.findMany({
      where: { ratedId: userId },
      include: {
        rater: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // احسب متوسط التقييم
    const avg = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(
          1,
        )
      : 0;

    res.json({ average: avg, total: ratings.length, ratings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// GET /api/ratings/my/given — التقييمات اللي أنا بعتها
// ============================================
router.get("/my/given", protect, async (req, res) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { raterId: req.user.id },
      include: {
        rated: { select: { id: true, name: true } },
        booking: { select: { id: true, date: true, field: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

module.exports = router;
