// ============================================
// routes/bookings.js — الحجوزات مع Prisma
// ============================================

const express        = require('express');
const jwt            = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// Middleware — التحقق من الـ Token
// ============================================
function protect(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token)
    return res.status(401).json({ error: 'لازم تسجل دخول الأول' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'الـ token غلط أو انتهت صلاحيته' });
  }
}

// ============================================
// GET /api/bookings/fields — جيب كل الملاعب (مش محتاج تسجيل دخول)
// ============================================
router.get('/fields', async (req, res) => {
  try {
    const fields = await prisma.field.findMany();
    res.json(fields);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

// ============================================
// GET /api/bookings — جيب كل حجوزات المستخدم
// ============================================
router.get('/', protect, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { field: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

// ============================================
// POST /api/bookings — عمل حجز جديد
// ============================================
router.post('/', protect, async (req, res) => {
  try {
    const { fieldId, date, time, duration, price } = req.body;

    if (!fieldId || !date || !time || !price)
      return res.status(400).json({ error: 'كل بيانات الحجز مطلوبة' });

    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field)
      return res.status(404).json({ error: 'الملعب مش موجود' });

    const conflict = await prisma.booking.findFirst({
      where: { fieldId, date, time, status: 'upcoming' },
    });
    if (conflict)
      return res.status(400).json({ error: 'الوقت ده محجوز بالفعل' });

    const booking = await prisma.booking.create({
      data: {
        userId:   req.user.id,
        fieldId,
        date,
        time,
        duration: duration || 1,
        price,
        status:   'upcoming',
      },
      include: { field: true },
    });

    res.status(201).json({ message: '✅ تم الحجز بنجاح!', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

// ============================================
// PATCH /api/bookings/:id/cancel — إلغاء حجز
// ============================================
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user.id },
    });

    if (!booking)
      return res.status(404).json({ error: 'الحجز مش موجود' });

    if (booking.status !== 'upcoming')
      return res.status(400).json({ error: 'الحجز ده مش ممكن يتلغى' });

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data:  { status: 'cancelled' },
    });

    res.json({ message: '✅ تم إلغاء الحجز', booking: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
});

module.exports = router;