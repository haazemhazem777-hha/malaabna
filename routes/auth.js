const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// POST /api/auth/register
// ============================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "كل الحقول مطلوبة" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists)
      return res.status(400).json({ error: "الإيميل ده مسجل قبل كده" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json({ message: "✅ تم إنشاء الحساب بنجاح!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ error: "الإيميل أو الباسورد غلط" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "الإيميل أو الباسورد غلط" });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "✅ تم تسجيل الدخول!",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});
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
// GET /api/auth/profile — جيب بيانات المستخدم
// ============================================
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        bio: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "المستخدم مش موجود" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});

// ============================================
// PATCH /api/auth/profile — تحديث بيانات المستخدم
// ============================================
router.patch("/profile", protect, async (req, res) => {
  try {
    const { name, age, bio } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(age && { age: parseInt(age) }),
        ...(bio !== undefined && { bio }),
      },
      select: { id: true, name: true, email: true, age: true, bio: true },
    });
    res.json({ message: "✅ تم التحديث!", user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر" });
  }
});
module.exports = router;
