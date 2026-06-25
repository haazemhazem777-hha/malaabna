const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 جاري تحديث الملاعب...");

  // امسح الحجوزات الأول عشان مفيش foreign key conflict
  await prisma.rating.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.field.deleteMany();

  const fields = await prisma.field.createMany({
    data: [
      {
        name: "ملعب النصر",
        location: "مدينة نصر",
        type: "5x5",
        surface: "عشب صناعي",
        price: 150,
        emoji: "🏟️",
        mapUrl: "https://maps.google.com/?q=Nasr+City,Cairo",
        openTime: 8, // 8 صباحاً
        closeTime: 24, // منتصف الليل
      },
      {
        name: "ملعب الأهلي",
        location: "المعادي",
        type: "7x7",
        surface: "إضاءة ليلية",
        price: 200,
        emoji: "⚽",
        mapUrl: "https://maps.google.com/?q=Maadi,Cairo",
        openTime: 14, // 2 ظهر
        closeTime: 24, // منتصف الليل
      },
      {
        name: "ملعب الزمالك",
        location: "الدقي",
        type: "5x5",
        surface: "مغطى",
        price: 180,
        emoji: "🥅",
        mapUrl: "https://maps.google.com/?q=Dokki,Giza",
        openTime: 6, // 6 صباحاً
        closeTime: 22, // 10 مساءً
      },
    ],
  });

  console.log(`✅ تم تحديث ${fields.count} ملاعب!`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
