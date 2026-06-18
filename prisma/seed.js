// ============================================
// prisma/seed.js — إضافة بيانات تجريبية لقاعدة البيانات
// ============================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 جاري إضافة الملاعب...');

  // امسح الملاعب القديمة (لو موجودة) عشان منكررش
  await prisma.field.deleteMany();

  const fields = await prisma.field.createMany({
    data: [
      {
        name:     'ملعب النصر',
        location: 'مدينة نصر',
        type:     '5x5',
        surface:  'عشب صناعي',
        price:    150,
        emoji:    '🏟️',
        mapUrl:   'https://maps.google.com/?q=Nasr+City,Cairo',
      },
      {
        name:     'ملعب الأهلي',
        location: 'المعادي',
        type:     '7x7',
        surface:  'إضاءة ليلية',
        price:    200,
        emoji:    '⚽',
        mapUrl:   'https://maps.google.com/?q=Maadi,Cairo',
      },
      {
        name:     'ملعب الزمالك',
        location: 'الدقي',
        type:     '5x5',
        surface:  'مغطى',
        price:    180,
        emoji:    '🥅',
        mapUrl:   'https://maps.google.com/?q=Dokki,Giza',
      },
    ],
  });

  console.log(`✅ تم إضافة ${fields.count} ملاعب بنجاح!`);
}


main()
  .catch((e) => {
    console.error('❌ حصل خطأ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });