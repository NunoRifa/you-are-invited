import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

export async function seedTemplates() {
  console.log('Seeding templates...');

  const templateList: Array<typeof schema.templates.$inferInsert> = [
    {
      id: 'raden-motion',
      displayName: 'Raden Motion',
      previewImagePath: '/templates/raden-motion/preview.jpg',
      supportsPantun: false,
      supportsHeroVideo: false,
      quoteBlockPosition: 'hero',
      galleryVideoType: 'none',
      isActive: true,
    },
    {
      id: 'betawi-motion',
      displayName: 'Betawi Motion',
      previewImagePath: '/templates/betawi-motion/preview.jpg',
      supportsPantun: true,
      supportsHeroVideo: true,
      quoteBlockPosition: 'closing',
      galleryVideoType: 'youtube',
      isActive: true,
    },
    {
      id: 'arjuna-tema-foto',
      displayName: 'Arjuna Tema Foto',
      previewImagePath: '/templates/arjuna-tema-foto/preview.jpg',
      supportsPantun: false,
      supportsHeroVideo: false,
      quoteBlockPosition: 'none',
      galleryVideoType: 'hosted',
      isActive: true,
    },
  ];

  for (const t of templateList) {
    const existing = db.select().from(schema.templates).where(eq(schema.templates.id, t.id)).get();
    if (!existing) {
      db.insert(schema.templates).values(t).run();
      console.log(`- Inserted template: ${t.id}`);
    } else {
      db.update(schema.templates).set(t).where(eq(schema.templates.id, t.id)).run();
      console.log(`- Updated template: ${t.id}`);
    }
  }

  // Seed sample demo invitations
  console.log('Seeding demo invitations...');
  const now = Date.now();

  // 1. Raden Motion Demo
  const radenSlug = 'raden-motion';
  const existingRaden = db.select().from(schema.invitations).where(eq(schema.invitations.slug, radenSlug)).get();
  if (!existingRaden) {
    const invId = 'inv-raden-motion-demo';
    db.insert(schema.invitations).values({
      id: invId,
      slug: radenSlug,
      title: 'Pernikahan Raden & Ayu',
      templateKey: 'raden-motion',
      openingGreetingText: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
      closingText: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.',
      quoteText: 'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
      quoteSource: 'QS. Ar-Rum: 21',
      coverGuestLabelDefault: 'Tamu Undangan',
      hashtag: '#RadenAyuForever',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Couples
    db.insert(schema.couples).values([
      {
        id: 'c-raden-groom',
        invitationId: invId,
        role: 'groom',
        fullName: 'Raden Mas Bagus Nugroho',
        displayName: 'Raden',
        fatherName: 'Bpk. H. Soedirman',
        motherName: 'Ibu Hj. Siti Fatimah',
        birthOrderLabel: 'Putra Pertama',
        instagramHandle: 'raden.bagus',
      },
      {
        id: 'c-raden-bride',
        invitationId: invId,
        role: 'bride',
        fullName: 'Ayu Kartika Sari, S.E.',
        displayName: 'Ayu',
        fatherName: 'Bpk. Drs. Bambang Wijaya',
        motherName: 'Ibu Ratna Kumala',
        birthOrderLabel: 'Putri Kedua',
        instagramHandle: 'ayukartika',
      },
    ]).run();

    // Events
    db.insert(schema.events).values([
      {
        id: 'ev-raden-akad',
        invitationId: invId,
        label: 'Akad Nikah',
        date: '2026-12-20',
        startTime: '08:00',
        endTimeLabel: '10:00 WIB',
        venueName: 'Masjid Agung Jawa Tengah',
        venueAddress: 'Jl. Gajah Raya, Sambirejo, Kec. Gayamsari, Kota Semarang',
        mapsUrl: 'https://maps.google.com/?q=Masjid+Agung+Jawa+Tengah',
        sortOrder: 1,
      },
      {
        id: 'ev-raden-resepsi',
        invitationId: invId,
        label: 'Resepsi Nikah',
        date: '2026-12-20',
        startTime: '11:00',
        endTimeLabel: '14:00 WIB',
        venueName: 'Grand Ballroom Hotel Semesta',
        venueAddress: 'Jl. KH. Wahid Hasyim No. 125, Semarang',
        mapsUrl: 'https://maps.google.com/?q=Grand+Ballroom+Semarang',
        sortOrder: 2,
      },
    ]).run();

    // Story
    db.insert(schema.storyItems).values([
      {
        id: 'st-raden-1',
        invitationId: invId,
        title: 'Awal Bertemu',
        date: '15 Mei 2022',
        description: 'Pertama kali kami dipertemukan dalam sebuah seminar pendidikan di kampus.',
        sortOrder: 1,
      },
      {
        id: 'st-raden-2',
        invitationId: invId,
        title: 'Lamaran',
        date: '10 Agustus 2025',
        description: 'Dengan restu kedua orang tua, Raden memberanikan diri mengikat komitmen.',
        sortOrder: 2,
      },
    ]).run();

    // Gift Accounts
    db.insert(schema.giftAccounts).values([
      {
        id: 'gf-raden-1',
        invitationId: invId,
        holderName: 'Raden Mas Bagus Nugroho',
        accountNumber: '1234567890',
        providerName: 'BCA',
        sortOrder: 1,
      },
      {
        id: 'gf-raden-2',
        invitationId: invId,
        holderName: 'Ayu Kartika Sari',
        accountNumber: '0987654321',
        providerName: 'Bank Mandiri',
        sortOrder: 2,
      },
    ]).run();

    // Wishes
    db.insert(schema.wishes).values([
      {
        id: 'w-raden-1',
        invitationId: invId,
        guestName: 'Keluarga Budi Santoso',
        attendanceStatus: 'attending',
        message: 'Barakallahu lakum wa baraka alaikum. Selamat menempuh hidup baru Raden & Ayu!',
        createdAt: now - 3600000,
      },
    ]).run();

    console.log(`- Seeded invitation: ${radenSlug}`);
  }

  // 2. Betawi Motion Demo
  const betawiSlug = 'betawi-motion';
  const existingBetawi = db.select().from(schema.invitations).where(eq(schema.invitations.slug, betawiSlug)).get();
  if (!existingBetawi) {
    const invId = 'inv-betawi-motion-demo';
    db.insert(schema.invitations).values({
      id: invId,
      slug: betawiSlug,
      title: 'Pernikahan Mpok Siti & Bang Ali',
      templateKey: 'betawi-motion',
      openingGreetingText: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
      closingText: 'Udah dulu ye abang none, kedatengan lu pade berkah buat keluwarge kami.',
      quoteText: 'Dan di antara tanda-tanda kekuasaan-Nya...',
      quoteSource: 'QS. Ar-Rum: 21',
      coverGuestLabelDefault: 'Tamu Undangan',
      hashtag: '#SitiAliKiteSah',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Template specific fields: pantun & hero video
    db.insert(schema.invitationTemplateFields).values([
      {
        id: 'tf-betawi-pantun',
        invitationId: invId,
        fieldKey: 'pantun_text',
        fieldValue: 'Buah nangka buah duren, pohon beringin lebat daonnya.\nAbang ganteng mpoknye keren, semoga langgeng selamanya.',
      },
      {
        id: 'tf-betawi-video',
        invitationId: invId,
        fieldKey: 'hero_video_url',
        fieldValue: 'https://assets.mixkit.co/videos/preview/mixkit-traditional-wedding-dance-42514-large.mp4',
      },
    ]).run();

    // Couples
    db.insert(schema.couples).values([
      {
        id: 'c-betawi-groom',
        invitationId: invId,
        role: 'groom',
        fullName: 'Muhammad Ali Ridho',
        displayName: 'Bang Ali',
        fatherName: 'Bpk. H. Sabeni',
        motherName: 'Ibu Hj. Zaenab',
        birthOrderLabel: 'Anak Bujang Ketige',
        instagramHandle: 'ali_betawi',
      },
      {
        id: 'c-betawi-bride',
        invitationId: invId,
        role: 'bride',
        fullName: 'Siti Rohayati, S.Pd.',
        displayName: 'Mpok Siti',
        fatherName: 'Bpk. H. Marzuki',
        motherName: 'Ibu Hj. Rohani',
        birthOrderLabel: 'Anak Dare Pertame',
        instagramHandle: 'siti.rohayati',
      },
    ]).run();

    // Events
    db.insert(schema.events).values([
      {
        id: 'ev-betawi-akad',
        invitationId: invId,
        label: 'Akad Nikah & Palang Pintu',
        date: '2026-11-15',
        startTime: '09:00',
        endTimeLabel: '11:00 WIB',
        venueName: 'Rumah Adat Betawi Situ Babakan',
        venueAddress: 'Srengseng Sawah, Jagakarsa, Jakarta Selatan',
        mapsUrl: 'https://maps.google.com/?q=Situ+Babakan+Jakarta',
        sortOrder: 1,
      },
    ]).run();

    // Story
    db.insert(schema.storyItems).values([
      {
        id: 'st-betawi-1',
        invitationId: invId,
        title: 'Kenalan di Rawa Belong',
        date: '12 Januari 2023',
        description: 'Ketemu waktu sama-sama lagi nyari kembang melati di pasar.',
        sortOrder: 1,
      },
    ]).run();

    // Gift Accounts
    db.insert(schema.giftAccounts).values([
      {
        id: 'gf-betawi-1',
        invitationId: invId,
        holderName: 'Muhammad Ali Ridho',
        accountNumber: '5412891023',
        providerName: 'BCA',
        sortOrder: 1,
      },
    ]).run();

    console.log(`- Seeded invitation: ${betawiSlug}`);
  }

  // 3. Arjuna Tema Foto Demo
  const arjunaSlug = 'arjuna-tema-foto';
  const existingArjuna = db.select().from(schema.invitations).where(eq(schema.invitations.slug, arjunaSlug)).get();
  if (!existingArjuna) {
    const invId = 'inv-arjuna-demo';
    db.insert(schema.invitations).values({
      id: invId,
      slug: arjunaSlug,
      title: 'The Wedding of Arjuna & Laras',
      templateKey: 'arjuna-tema-foto',
      openingGreetingText: 'Together with their families',
      closingText: 'Thank you for being part of our special journey.',
      coverGuestLabelDefault: 'Tamu Undangan',
      hashtag: '#ArjunaLarasWedding',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Couples
    db.insert(schema.couples).values([
      {
        id: 'c-arjuna-groom',
        invitationId: invId,
        role: 'groom',
        fullName: 'Arjuna Danendra, B.Eng',
        displayName: 'Arjuna',
        fatherName: 'Mr. Hendra Danendra',
        motherName: 'Mrs. Maya Danendra',
        birthOrderLabel: 'First Son',
        instagramHandle: 'arjuna.danendra',
      },
      {
        id: 'c-arjuna-bride',
        invitationId: invId,
        role: 'bride',
        fullName: 'Laras Sekar Wangi, M.Ds',
        displayName: 'Laras',
        fatherName: 'Mr. Wijoyo Kusumo',
        motherName: 'Mrs. Endang Kusumo',
        birthOrderLabel: 'Second Daughter',
        instagramHandle: 'laras.sekar',
      },
    ]).run();

    // Events
    db.insert(schema.events).values([
      {
        id: 'ev-arjuna-ceremony',
        invitationId: invId,
        label: 'Holy Matrimony & Reception',
        date: '2026-10-25',
        startTime: '16:00',
        endTimeLabel: '21:00 WIB',
        venueName: 'The Glass House Garden',
        venueAddress: 'Kawasan Puncak Cipanas, Jawa Barat',
        mapsUrl: 'https://maps.google.com/?q=The+Glass+House+Puncak',
        sortOrder: 1,
      },
    ]).run();

    // Story
    db.insert(schema.storyItems).values([
      {
        id: 'st-arjuna-1',
        invitationId: invId,
        title: 'Acara Lamaran',
        date: '14 Februari 2026',
        description: 'A private moment shared with our closest friends and family.',
        sortOrder: 1,
      },
      {
        id: 'st-arjuna-2',
        invitationId: invId,
        title: 'Acara Pernikahan',
        date: '25 Oktober 2026',
        description: 'The beginning of our lifelong adventure together.',
        sortOrder: 2,
      },
    ]).run();

    // Gift Accounts
    db.insert(schema.giftAccounts).values([
      {
        id: 'gf-arjuna-1',
        invitationId: invId,
        holderName: 'Arjuna Danendra',
        accountNumber: '9870123456',
        providerName: 'Bank Mandiri',
        sortOrder: 1,
      },
    ]).run();

    console.log(`- Seeded invitation: ${arjunaSlug}`);
  }

  console.log('Seeding complete.');
}

if (process.argv[1]?.endsWith('templates.ts') || process.argv[1]?.endsWith('templates.js')) {
  seedTemplates().catch(console.error);
}
