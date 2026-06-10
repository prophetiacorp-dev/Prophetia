require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');
const { Resend } = require('resend');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

/*
  PRODUCCIÓN:
  - FIREBASE_ADMIN_CREDENTIALS apunta al service account privado.
  - En local usamos ./secrets/firebase-admin.json.
  - Nunca subir /secrets ni firebase-admin.json a GitHub.
  - En producción, guardar la credencial como secreto/variable segura del servidor.
*/
const FIREBASE_ADMIN_CREDENTIALS = process.env.FIREBASE_ADMIN_CREDENTIALS
  ? path.resolve(__dirname, process.env.FIREBASE_ADMIN_CREDENTIALS)
  : '';

if (!admin.apps.length) {
  if (!FIREBASE_ADMIN_CREDENTIALS || !fs.existsSync(FIREBASE_ADMIN_CREDENTIALS)) {
    console.warn('[firebase-admin] No se ha encontrado FIREBASE_ADMIN_CREDENTIALS. /api/my-orders no funcionará en modo seguro.');
  } else {
    const serviceAccount = require(FIREBASE_ADMIN_CREDENTIALS);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('[firebase-admin] inicializado correctamente.');
  }
}

/*
  PRODUCCIÓN:
  - Local:
      NODE_ENV=development
      SITE_URL=http://127.0.0.1:4242

  - Producción:
      NODE_ENV=production
      SITE_URL=https://prophetia.es

  - SITE_URL se usa para Stripe success_url/cancel_url y enlaces internos.
  - PORT normalmente lo asigna la plataforma de hosting.
*/
const PORT = process.env.PORT || 4242;
const SITE_URL = process.env.SITE_URL || `http://127.0.0.1:${PORT}`;
/*
  PRODUCCIÓN:
  Validación de variables críticas.
  En local permite trabajar aunque falte alguna clave.
  En producción detiene el servidor si falta algo imprescindible.
*/
const REQUIRED_ENV_IN_PRODUCTION = [
  'SITE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'ORDER_FROM_EMAIL',
  'ORDER_INTERNAL_EMAIL',
  'FIREBASE_ADMIN_CREDENTIALS'
];

if (process.env.NODE_ENV === 'production') {
  const missingEnv = REQUIRED_ENV_IN_PRODUCTION.filter((key) => {
    return !process.env[key];
  });

  if (missingEnv.length) {
    throw new Error(
      `[env] Faltan variables obligatorias en producción: ${missingEnv.join(', ')}`
    );
  }
}

const DATA_DIR = path.join(__dirname, 'data');

const ORDERS_DIR = DATA_DIR;
const ORDERS_FILE = path.join(ORDERS_DIR, 'orders.json');

const STOCK_FILE = path.join(DATA_DIR, 'stock.json');
const SHIPPING_RATES_FILE = path.join(DATA_DIR, 'shipping-rates.json');
const TRIBE_MEMBERS_FILE = path.join(DATA_DIR, 'tribe-members.json');
const PRIVATE_DROPS_FILE = path.join(DATA_DIR, 'private-drops.json');
const PRIVATE_DROP_PAGES_FILE = path.join(DATA_DIR, 'private-drop-pages.json');

const TRIBE_DISCOUNT_CODE = 'TRIBE10';
const TRIBE_DISCOUNT_PERCENT = 10;
const TRIBE_MIN_SUBTOTAL = 40;
const TRIBE_POINTS_PER_EURO = 1;
const TRIBE_POINTS_REDEEM_COST = 100;

/* =========================================================
   PROPHETIA · TRIBE CONFIG
   Rangos, prestigio, misiones y persistencia local
   ========================================================= */

const TRIBE_MEMBER_PROFILE = {
  id: 'tribe-member',
  label: 'Tribe Member',
  min: 0,
  accessLabel: 'Archivo abierto',
  objective: 'Activa tu recorrido dentro de Prophetia Tribe.',
  earlyAccessHours: 0,
  freeShipping: {
    enabled: false,
    minSubtotal: null
  },
  priority: 'standard',
  benefits: [
    'Acceso al archivo privado Prophetia Tribe.',
    'Código de bienvenida disponible si no se ha utilizado.',
    'Progreso LP visible dentro de tu cuenta.'
  ],
  message: 'Tu archivo personal está abierto. La primera acción validada activará tu recorrido.',
  rewardOnUnlock: null
};

const TRIBE_RANKS = [
  {
    id: 'initiate',
    label: 'Initiate',
    min: 1,
    accessLabel: 'Initiate Access',
    objective: 'Primer rango activo dentro de Prophetia Tribe.',
    earlyAccessHours: 0,
    freeShipping: {
      enabled: false,
      minSubtotal: null
    },
    priority: 'standard',
    benefits: [
      'Progreso LP activo.',
      'Acceso a beneficios Tribe iniciales.',
      'Archivo personal desbloqueado.'
    ],
    message: 'Has iniciado tu recorrido dentro de Prophetia Tribe.',
    rewardOnUnlock: null
  },
  {
    id: 'adeptus',
    label: 'Adeptus',
    min: 100,
    accessLabel: 'Adeptus Access',
    objective: 'Consolidar tu archivo personal Prophetia.',
    earlyAccessHours: 6,
    freeShipping: {
      enabled: false,
      minSubtotal: null
    },
    priority: 'standard',
    benefits: [
      'Acceso anticipado ligero a futuras cápsulas.',
      'Recompensa privada al desbloquear el rango.',
      'Prioridad estándar en futuras experiencias Tribe.'
    ],
    message: 'Tu vínculo con Prophetia Tribe empieza a consolidarse.',
    rewardOnUnlock: {
      type: 'rank_discount',
      percent: 10,
      label: '10% privado Adeptus',
      minSubtotal: 40,
      singleUse: true
    }
  },
  {
    id: 'oracle',
    label: 'Oracle',
    min: 250,
    accessLabel: 'Oracle Access',
    objective: 'Acceso superior a beneficios y recompensas privadas.',
    earlyAccessHours: 12,
    freeShipping: {
      enabled: true,
      minSubtotal: 60
    },
    priority: 'priority',
    benefits: [
      'Mayor acceso anticipado.',
      'Envío gratuito desde 60 €.',
      'Recompensa privada al desbloquear el rango.',
      'Prioridad superior en soporte y futuras cápsulas.'
    ],
    message: 'Has alcanzado una posición avanzada dentro del archivo Prophetia.',
    rewardOnUnlock: {
      type: 'rank_discount',
      percent: 15,
      label: '15% privado Oracle',
      minSubtotal: 60,
      singleUse: true
    }
  },
  {
    id: 'seer',
    label: 'Seer',
    min: 500,
    accessLabel: 'Seer Access',
    objective: 'Acceso privado avanzado a recompensas y prioridad.',
    earlyAccessHours: 24,
    freeShipping: {
      enabled: true,
      minSubtotal: 40
    },
    priority: 'high',
    benefits: [
      'Acceso anticipado 24 h.',
      'Envío gratuito desde 40 €.',
      'Recompensa privada al desbloquear el rango.',
      'Prioridad alta en soporte y futuras experiencias.'
    ],
    message: 'Tu archivo Prophetia revela un nivel superior.',
    rewardOnUnlock: {
      type: 'rank_discount',
      percent: 20,
      label: '20% privado Seer',
      minSubtotal: 70,
      singleUse: true
    }
  },
  {
    id: 'prophet',
    label: 'Prophet',
    min: 1000,
    accessLabel: 'Prophet Access',
    objective: 'Rango máximo antes del sistema de prestigio.',
    earlyAccessHours: 48,
    freeShipping: {
      enabled: true,
      minSubtotal: 0
    },
    priority: 'highest',
    benefits: [
      'Acceso anticipado 48 h.',
      'Envío gratuito permanente.',
      'Prioridad máxima en soporte.',
      'Acceso preferente a futuras experiencias privadas.'
    ],
    message: 'Has alcanzado Prophet. A partir de aquí comienza el prestigio.',
    rewardOnUnlock: {
      type: 'rank_discount',
      percent: 25,
      label: '25% privado Prophet',
      minSubtotal: 80,
      singleUse: true
    }
  }
];

const TRIBE_PRESTIGE_LEVELS = [
  {
    level: 1,
    id: 'prophet-i',
    label: 'Prophet I',
    emblem: 'I',
    min: 1000,
    nextAt: 1500,
    nextLabel: 'Prophet II',
    benefits: [
      'Prestigio Prophet activo.',
      'Archivo superior desbloqueado.',
      'Ventajas Prophet mantenidas.'
    ]
  },
  {
    level: 2,
    id: 'prophet-ii',
    label: 'Prophet II',
    emblem: 'II',
    min: 1500,
    nextAt: 2250,
    nextLabel: 'Prophet III',
    benefits: [
      'Prestigio Prophet II.',
      'Mayor reconocimiento dentro de Tribe.',
      'Acceso preferente a futuras recompensas.'
    ]
  },
  {
    level: 3,
    id: 'prophet-iii',
    label: 'Prophet III',
    emblem: 'III',
    min: 2250,
    nextAt: null,
    nextLabel: null,
    benefits: [
      'Prestigio Prophet III.',
      'Máxima distinción del archivo Tribe.',
      'Acceso preferente a futuras experiencias privadas.'
    ]
  }
];

const TRIBE_MISSIONS = [
  {
    id: 'join-tribe',
    title: 'Abrir el archivo Tribe',
    description: 'Forma parte de Prophetia Tribe y activa tu archivo personal.',
    points: 0,
    target: 1,
    type: 'server',
    autoClaim: true,
    publicLabel: 'Archivo abierto'
  },
  {
    id: 'first-address',
    title: 'Añade tu primera dirección',
    description: 'Guarda una dirección para preparar futuros envíos de forma más rápida.',
    points: 10,
    target: 1,
    type: 'address',
    autoClaim: true,
    publicLabel: 'Dirección guardada'
  },
  {
    id: 'first-order',
    title: 'Primera adquisición',
    description: 'Completa tu primera compra confirmada dentro de Prophetia.',
    points: 0,
    target: 1,
    type: 'paid-order',
    autoClaim: true,
    publicLabel: 'Primera adquisición'
  },
  {
    id: 'initiate-unlocked',
    title: 'Revela Initiate',
    description: 'Activa tu primer rango ceremonial dentro de Prophetia Tribe.',
    points: 0,
    target: 1,
    type: 'rank',
    autoClaim: true,
    publicLabel: 'Rango revelado'
  },
  {
    id: 'wishlist-3',
    title: 'Guarda 3 piezas',
    description: 'Construye tu primera selección personal dentro del archivo Prophetia.',
    points: 0,
    target: 3,
    type: 'local-wishlist',
    autoClaim: false,
    publicLabel: 'Selección personal'
  }
];

/* =========================================================
   PROPHETIA · TRIBE STORAGE
   data/tribe-members.json
   ========================================================= */

function ensureTribeMembersFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(TRIBE_MEMBERS_FILE)) {
    fs.writeFileSync(TRIBE_MEMBERS_FILE, '[]', 'utf8');
  }
}

function loadTribeMembers() {
  ensureTribeMembersFile();

  try {
    const raw = fs.readFileSync(TRIBE_MEMBERS_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[tribe] No se ha podido leer tribe-members.json:', err.message);
    return [];
  }
}

function saveTribeMembers(members = []) {
  ensureTribeMembersFile();

  fs.writeFileSync(
    TRIBE_MEMBERS_FILE,
    JSON.stringify(Array.isArray(members) ? members : [], null, 2),
    'utf8'
  );
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function roundMoney(value = 0) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function calculateAgeFromBirthDate(birthDate = '') {
  const date = new Date(birthDate);

  if (Number.isNaN(date.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate());

  if (today < birthdayThisYear) age--;

  return age;
}

function findTribeMemberByEmail(email = '') {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;

  return loadTribeMembers().find((member) => {
    return normalizeEmail(member.email) === cleanEmail;
  }) || null;
}

function upsertTribeMember(memberInput) {
  const members = loadTribeMembers();
  const cleanEmail = normalizeEmail(memberInput.email);

  const index = members.findIndex((member) => {
    return normalizeEmail(member.email) === cleanEmail;
  });

  const now = new Date().toISOString();

  if (index >= 0) {
    const existing = members[index];

    const updatedMember = {
      ...existing,
      id: existing.id || cleanEmail,
      name: String(memberInput.name || existing.name || '').trim(),
      email: cleanEmail,
      birthDate: String(memberInput.birthDate || existing.birthDate || '').trim(),
      optin: !!memberInput.optin,
      status: existing.status || 'active',

      points: Number(existing.points || 0),
      pointsRequiredForNextDiscount: Number(existing.pointsRequiredForNextDiscount || 100),

      discountCode: existing.discountCode || TRIBE_DISCOUNT_CODE,
      discountPercent: Number(existing.discountPercent || TRIBE_DISCOUNT_PERCENT),
      discountStatus: existing.discountStatus || 'available',
      discountIssuedAt: existing.discountIssuedAt || existing.createdAt || now,
      discountUsedAt: existing.discountUsedAt || null,
      discountUsedOrderId: existing.discountUsedOrderId || null,
      usedCount: Number(existing.usedCount || 0),

      updatedAt: now
    };

    members[index] = updatedMember;
    saveTribeMembers(members);

    return {
      ...updatedMember,
      alreadyMember: true,
      codeIssuedNow: false
    };
  }

  const payload = {
    id: cleanEmail,
    name: String(memberInput.name || '').trim(),
    email: cleanEmail,
    birthDate: String(memberInput.birthDate || '').trim(),
    optin: !!memberInput.optin,
    status: 'active',

    points: 0,
    pointsRequiredForNextDiscount: 100,

    discountCode: TRIBE_DISCOUNT_CODE,
    discountPercent: TRIBE_DISCOUNT_PERCENT,
    discountStatus: 'available',
    discountIssuedAt: now,
    discountUsedAt: null,
    discountUsedOrderId: null,
    usedCount: 0,

    createdAt: now,
    updatedAt: now
  };

  members.push(payload);
  saveTribeMembers(members);

  return {
    ...payload,
    alreadyMember: false,
    codeIssuedNow: true
  };
}

function findAvailableRankReward(member, cleanCode = '') {
  const rewards = Array.isArray(member?.unlockedRewards)
    ? member.unlockedRewards
    : [];

  return rewards.find((reward) => {
    return (
      String(reward.code || '').trim().toUpperCase() === cleanCode &&
      String(reward.status || '').toLowerCase() === 'available'
    );
  }) || null;
}

function validateTribeDiscount({ email = '', code = '', subtotal = 0 } = {}) {
  const cleanEmail = normalizeEmail(email);
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanSubtotal = Number(subtotal || 0);

  if (!cleanCode) {
    return {
      valid: false,
      code: '',
      type: '',
      percent: 0,
      amount: 0,
      reason: 'Sin código de descuento.'
    };
  }

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return {
      valid: false,
      code: cleanCode,
      type: '',
      percent: 0,
      amount: 0,
      reason: 'Email no válido.'
    };
  }

  const member = findTribeMemberByEmail(cleanEmail);

  if (!member || member.status !== 'active') {
    return {
      valid: false,
      code: cleanCode,
      type: '',
      percent: 0,
      amount: 0,
      reason: 'Este email no pertenece a Prophetia Tribe.'
    };
  }

  /*
    1) Código bienvenida TRIBE10
    - Solo una vez por email.
    - Mínimo TRIBE_MIN_SUBTOTAL.
  */
  if (cleanCode === TRIBE_DISCOUNT_CODE) {
    if (member.discountStatus !== 'available' || Number(member.usedCount || 0) > 0) {
      return {
        valid: false,
        code: cleanCode,
        type: 'welcome_code',
        percent: 0,
        amount: 0,
        reason: 'Este código Tribe ya ha sido utilizado. Podrás recibir otras recompensas acumulando Legacy Points.'
      };
    }

    if (cleanSubtotal < TRIBE_MIN_SUBTOTAL) {
      return {
        valid: false,
        code: cleanCode,
        type: 'welcome_code',
        percent: 0,
        amount: 0,
        reason: `El pedido mínimo para usar ${TRIBE_DISCOUNT_CODE} es ${TRIBE_MIN_SUBTOTAL} €.`
      };
    }

    const amount = roundMoney(cleanSubtotal * (TRIBE_DISCOUNT_PERCENT / 100));

    return {
      valid: true,
      code: cleanCode,
      type: 'welcome_code',
      rewardId: null,
      rankId: 'initiate',
      rank: 'Initiate',
      percent: TRIBE_DISCOUNT_PERCENT,
      amount,
      minSubtotal: TRIBE_MIN_SUBTOTAL,
      reason: ''
    };
  }

  /*
    2) Recompensas privadas de rango
    - PP-ADEPTUS-...
    - PP-ORACLE-...
    - Deben existir en unlockedRewards del usuario.
    - Deben estar available.
  */
  const reward = findAvailableRankReward(member, cleanCode);

  if (!reward) {
    const allRewards = Array.isArray(member.unlockedRewards)
      ? member.unlockedRewards
      : [];

    const existingReward = allRewards.find((item) => {
      return String(item.code || '').trim().toUpperCase() === cleanCode;
    });

    return {
      valid: false,
      code: cleanCode,
      type: existingReward?.type || 'rank_discount',
      percent: 0,
      amount: 0,
      reason: existingReward
        ? 'Esta recompensa privada ya ha sido utilizada.'
        : 'Código no válido o no pertenece a tu cuenta Prophetia Tribe.'
    };
  }

  if (reward.type !== 'rank_discount') {
    return {
      valid: false,
      code: cleanCode,
      type: reward.type || '',
      percent: 0,
      amount: 0,
      reason: 'Esta recompensa no es un descuento aplicable en checkout.'
    };
  }

  const minSubtotal = Number(reward.minSubtotal || 0);

  if (cleanSubtotal < minSubtotal) {
    return {
      valid: false,
      code: cleanCode,
      type: 'rank_discount',
      rewardId: reward.id || null,
      rankId: reward.rankId || '',
      rank: reward.rank || '',
      percent: 0,
      amount: 0,
      minSubtotal,
      reason: `El pedido mínimo para usar esta recompensa ${reward.rank || 'Tribe'} es ${minSubtotal} €.`
    };
  }

  const percent = Number(reward.percent || 0);
  const amount = roundMoney(cleanSubtotal * (percent / 100));

  if (percent <= 0 || amount <= 0) {
    return {
      valid: false,
      code: cleanCode,
      type: 'rank_discount',
      rewardId: reward.id || null,
      rankId: reward.rankId || '',
      rank: reward.rank || '',
      percent: 0,
      amount: 0,
      minSubtotal,
      reason: 'Esta recompensa no tiene un descuento válido.'
    };
  }

  return {
    valid: true,
    code: cleanCode,
    type: 'rank_discount',
    rewardId: reward.id || null,
    rankId: reward.rankId || '',
    rank: reward.rank || '',
    percent,
    amount,
    minSubtotal,
    reason: ''
  };
}
function markTribeDiscountUsed({ email = '', code = '', orderId = '' } = {}) {
  const cleanEmail = normalizeEmail(email);
  const cleanCode = String(code || '').trim().toUpperCase();

  if (!cleanEmail || !cleanCode) return null;

  const members = loadTribeMembers();
  const index = members.findIndex((member) => {
    return normalizeEmail(member.email) === cleanEmail;
  });

  if (index < 0) return null;

  const member = members[index];
  const now = new Date().toISOString();

  /*
    1) TRIBE10 bienvenida
  */
  if (cleanCode === TRIBE_DISCOUNT_CODE) {
    if (member.discountStatus === 'used') {
      return member;
    }

    members[index] = {
      ...member,
      discountStatus: 'used',
      discountUsedAt: now,
      discountUsedOrderId: orderId || null,
      usedCount: Number(member.usedCount || 0) + 1,
      updatedAt: now
    };

    saveTribeMembers(members);
    return members[index];
  }

  /*
    2) Recompensas privadas PP-ADEPTUS / PP-ORACLE
  */
  const rewards = Array.isArray(member.unlockedRewards)
    ? member.unlockedRewards
    : [];

  let rewardMatched = false;

  const updatedRewards = rewards.map((reward) => {
    const rewardCode = String(reward.code || '').trim().toUpperCase();

    if (rewardCode !== cleanCode) {
      return reward;
    }

    rewardMatched = true;

    if (String(reward.status || '').toLowerCase() === 'used') {
      return reward;
    }

    return {
      ...reward,
      status: 'used',
      usedAt: now,
      usedOrderId: orderId || null
    };
  });

  if (!rewardMatched) {
    return member;
  }

  members[index] = {
    ...member,
    unlockedRewards: updatedRewards,
    lastUsedRewardCode: cleanCode,
    lastUsedRewardOrderId: orderId || null,
    updatedAt: now
  };

  saveTribeMembers(members);
  return members[index];
}
function getTribeRankInfo(lifetimePoints = 0) {
  const points = Math.max(0, Number(lifetimePoints || 0));

  /*
    0 XP no debe considerarse un rango ganado.
    El registro abre el archivo; la primera compra activa Initiate.
  */
  if (points <= 0) {
    return {
      rank: TRIBE_MEMBER_PROFILE.label,
      rankId: TRIBE_MEMBER_PROFILE.id,
      rankMin: 0,
      nextRank: 'Initiate',
      nextRankId: 'initiate',
      nextRankAt: 1,
      pointsToNextRank: 1,
      progressPercent: 0,
      isRankActivated: false
    };
  }

  let current = TRIBE_RANKS[0];
  let next = null;

  for (let i = 0; i < TRIBE_RANKS.length; i++) {
    const rank = TRIBE_RANKS[i];

    if (points >= rank.min) {
      current = rank;
      next = TRIBE_RANKS[i + 1] || null;
    }
  }

  const currentMin = current.min;
  const nextMin = next ? next.min : current.min;
  const range = next ? Math.max(1, nextMin - currentMin) : 1;
  const gainedInRank = Math.max(0, points - currentMin);
  const progressPercent = next
    ? Math.max(0, Math.min(100, Math.round((gainedInRank / range) * 100)))
    : 100;

  return {
    rank: current.label,
    rankId: current.id,
    rankMin: currentMin,
    nextRank: next ? next.label : null,
    nextRankId: next ? next.id : null,
    nextRankAt: next ? next.min : null,
    pointsToNextRank: next ? Math.max(0, next.min - points) : 0,
    progressPercent,
    isRankActivated: true
  };
}
function getTribePrestigeInfo(lifetimePoints = 0) {
  const points = Math.max(0, Number(lifetimePoints || 0));

  if (points < 1000) {
    return {
      isPrestigeActive: false,
      prestigeLevel: 0,
      prestigeId: '',
      prestigeLabel: '',
      prestigeEmblem: '',
      prestigeMin: null,
      nextPrestigeAt: null,
      nextPrestigeLabel: null,
      pointsToNextPrestige: null,
      prestigeProgressPercent: 0,
      prestigeBenefits: []
    };
  }

  let current = TRIBE_PRESTIGE_LEVELS[0];

  for (const level of TRIBE_PRESTIGE_LEVELS) {
    if (points >= level.min) {
      current = level;
    }
  }

  const nextAt = current.nextAt;
  const range = nextAt ? Math.max(1, nextAt - current.min) : 1;
  const gained = Math.max(0, points - current.min);

  return {
    isPrestigeActive: true,
    prestigeLevel: current.level,
    prestigeId: current.id,
    prestigeLabel: current.label,
    prestigeEmblem: current.emblem,
    prestigeMin: current.min,
    nextPrestigeAt: nextAt,
    nextPrestigeLabel: current.nextLabel,
    pointsToNextPrestige: nextAt ? Math.max(0, nextAt - points) : 0,
    prestigeProgressPercent: nextAt
      ? Math.max(0, Math.min(100, Math.round((gained / range) * 100)))
      : 100,
    prestigeBenefits: current.benefits || []
  };
}

function getTribeRankConfig(rankId = 'initiate') {
  const cleanRankId = String(rankId || 'initiate').trim().toLowerCase();

  if (cleanRankId === TRIBE_MEMBER_PROFILE.id) {
    return TRIBE_MEMBER_PROFILE;
  }

  return TRIBE_RANKS.find((rank) => rank.id === cleanRankId) || TRIBE_RANKS[0];
}

function getPublicTribeRankBenefits(rankId = 'initiate') {
  const rank = getTribeRankConfig(rankId);

  return {
    accessLabel: rank.accessLabel,
    objective: rank.objective,
    earlyAccessHours: rank.earlyAccessHours,
    freeShipping: rank.freeShipping,
    priority: rank.priority,
    benefits: rank.benefits,
    message: rank.message,
    rewardOnUnlock: rank.rewardOnUnlock
      ? {
          type: rank.rewardOnUnlock.type,
          percent: rank.rewardOnUnlock.percent || null,
          label: rank.rewardOnUnlock.label || null,
          minSubtotal: rank.rewardOnUnlock.minSubtotal || null,
          singleUse: !!rank.rewardOnUnlock.singleUse
        }
      : null
  };
}
function sanitizeTribeReward(reward = {}) {
  if (!reward || reward.type !== 'rank_discount') {
    return null;
  }

  return {
    id: reward.id || '',
    rankId: reward.rankId || '',
    rank: reward.rank || '',
    type: reward.type || 'rank_discount',
    code: String(reward.code || '').trim().toUpperCase(),
    percent: Number(reward.percent || 0),
    minSubtotal: Number(reward.minSubtotal || 0),
    singleUse: reward.singleUse !== false,
    status: String(reward.status || 'available').toLowerCase(),
    createdAt: reward.createdAt || null,
    usedAt: reward.usedAt || null,
    usedOrderId: reward.usedOrderId || null
  };
}

function sortPublicRewards(rewards = []) {
  const statusWeight = {
    available: 0,
    used: 1
  };

  return rewards.sort((a, b) => {
    const statusA = statusWeight[a.status] ?? 9;
    const statusB = statusWeight[b.status] ?? 9;

    if (statusA !== statusB) return statusA - statusB;

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function getPublicTribeRewards(member = {}) {
  const rewards = Array.isArray(member.unlockedRewards)
    ? member.unlockedRewards
    : [];

  return sortPublicRewards(
    rewards
      .map(sanitizeTribeReward)
      .filter(Boolean)
      .filter((reward) => reward.code && reward.percent > 0)
  );
}

function getPublicLastUnlockedRewards(member = {}) {
  const rewards = Array.isArray(member.lastUnlockedRewards)
    ? member.lastUnlockedRewards
    : [];

  return sortPublicRewards(
    rewards
      .map(sanitizeTribeReward)
      .filter(Boolean)
      .filter((reward) => reward.code && reward.percent > 0)
  );
}
/* =========================================================
   PROPHETIA · TRIBE MISSIONS HELPERS
   ========================================================= */

function getMissionConfig(missionId = '') {
  const cleanMissionId = String(missionId || '').trim();

  return TRIBE_MISSIONS.find((mission) => mission.id === cleanMissionId) || null;
}

function normalizeMemberMissions(member = {}) {
  const stored = member && typeof member.missions === 'object' && !Array.isArray(member.missions)
    ? member.missions
    : {};

  const now = new Date().toISOString();

  return TRIBE_MISSIONS.reduce((acc, mission) => {
    const existing = stored[mission.id] || {};
    const progress = Math.max(0, Math.min(
      Number(existing.progress || 0),
      Number(mission.target || 1)
    ));

    const isCompleted =
      existing.status === 'completed' ||
      existing.completed === true ||
      progress >= Number(mission.target || 1);

    acc[mission.id] = {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      points: Number(mission.points || 0),
      target: Number(mission.target || 1),
      progress: isCompleted ? Number(mission.target || 1) : progress,
      status: isCompleted ? 'completed' : 'pending',
      completed: isCompleted,
      completedAt: existing.completedAt || null,
      pointsAppliedAt: existing.pointsAppliedAt || null,
      publicLabel: mission.publicLabel || '',
      type: mission.type,
      autoClaim: !!mission.autoClaim,
      updatedAt: existing.updatedAt || now
    };

    return acc;
  }, {});
}

function getPublicTribeMissions(member = {}) {
  const normalized = normalizeMemberMissions(member);

  return TRIBE_MISSIONS.map((mission) => {
    const state = normalized[mission.id];

    return {
      id: state.id,
      title: state.title,
      description: state.description,
      points: state.points,
      target: state.target,
      progress: state.progress,
      status: state.status,
      completed: state.completed,
      completedAt: state.completedAt,
      publicLabel: state.publicLabel,
      type: state.type,
      autoClaim: state.autoClaim
    };
  });
}

function completeTribeMissionForEmail({
  email = '',
  missionId = '',
  progress = null,
  reason = ''
} = {}) {
  const cleanEmail = normalizeEmail(email);
  const mission = getMissionConfig(missionId);

  if (!cleanEmail || !mission) {
    return {
      ok: false,
      completedNow: false,
      error: 'Misión no válida.'
    };
  }

  const members = loadTribeMembers();
  const index = members.findIndex((member) => normalizeEmail(member.email) === cleanEmail);

  if (index < 0) {
    return {
      ok: false,
      completedNow: false,
      error: 'Miembro Tribe no encontrado.'
    };
  }

  const member = members[index];

  if (member.status !== 'active') {
    return {
      ok: false,
      completedNow: false,
      error: 'Miembro Tribe inactivo.'
    };
  }

  const now = new Date().toISOString();
  const missions = normalizeMemberMissions(member);
  const currentMission = missions[mission.id];

  if (currentMission.completed) {
    return {
      ok: true,
      completedNow: false,
      mission: currentMission,
      member
    };
  }

  const target = Number(mission.target || 1);
  const nextProgress = progress === null || progress === undefined
    ? target
    : Math.max(0, Math.min(Number(progress || 0), target));

  const shouldComplete = nextProgress >= target;

  const previousPoints = Number(member.points || 0);
  const previousLifetimePoints = Number(member.lifetimePoints || member.points || 0);
  const missionPoints = shouldComplete ? Number(mission.points || 0) : 0;

  const newPoints = previousPoints + missionPoints;
  const newLifetimePoints = previousLifetimePoints + missionPoints;

  const previousRankInfo = getTribeRankInfo(previousLifetimePoints);
  const previousPrestigeInfo = getTribePrestigeInfo(previousLifetimePoints);
  const newRankInfo = getTribeRankInfo(newLifetimePoints);
  const newPrestigeInfo = getTribePrestigeInfo(newLifetimePoints);

  const existingRewards = Array.isArray(member.unlockedRewards)
    ? member.unlockedRewards
    : [];

  const unlockedRewardsNow = missionPoints > 0
    ? buildRankUnlockRewards({
        previousLifetimePoints,
        newLifetimePoints,
        existingRewards
      })
    : [];

  const missionEvent = shouldComplete
    ? {
        type: 'mission-completed',
        missionId: mission.id,
        missionTitle: mission.title,
        reason: reason || mission.type,
        email: cleanEmail,
        pointsEarned: missionPoints,
        previousPoints,
        newPoints,
        previousLifetimePoints,
        newLifetimePoints,
        previousRank: previousRankInfo.rank,
        newRank: newRankInfo.rank,
        nextRank: newRankInfo.nextRank,
        nextRankAt: newRankInfo.nextRankAt,
        pointsToNextRank: newRankInfo.pointsToNextRank,
        previousProgressPercent: previousRankInfo.progressPercent,
        newProgressPercent: newRankInfo.progressPercent,
        leveledUp: previousRankInfo.rank !== newRankInfo.rank,
        previousPrestige: previousPrestigeInfo,
        newPrestige: newPrestigeInfo,
        prestigeUnlocked:
          previousPrestigeInfo.prestigeLevel !== newPrestigeInfo.prestigeLevel,
        prestigeLabel: newPrestigeInfo.prestigeLabel,
        nextPrestigeLabel: newPrestigeInfo.nextPrestigeLabel,
        pointsToNextPrestige: newPrestigeInfo.pointsToNextPrestige,
        prestigeProgressPercent: newPrestigeInfo.prestigeProgressPercent,
        xpAnimationSteps: missionPoints > 0
          ? buildXpAnimationSteps(previousLifetimePoints, newLifetimePoints)
          : [],
        unlockedRewards: unlockedRewardsNow,
        createdAt: now
      }
    : null;

  const updatedMission = {
    ...currentMission,
    progress: shouldComplete ? target : nextProgress,
    status: shouldComplete ? 'completed' : 'pending',
    completed: shouldComplete,
    completedAt: shouldComplete ? now : null,
    pointsAppliedAt: shouldComplete && missionPoints > 0 ? now : null,
    updatedAt: now
  };

  const xpEvents = Array.isArray(member.xpEvents)
    ? member.xpEvents
    : [];

  members[index] = {
    ...member,
    points: shouldComplete ? newPoints : previousPoints,
    lifetimePoints: shouldComplete ? newLifetimePoints : previousLifetimePoints,
    rank: shouldComplete ? newRankInfo.rank : member.rank,
    rankId: shouldComplete ? newRankInfo.rankId : member.rankId,
    nextRank: shouldComplete ? newRankInfo.nextRank : member.nextRank,
    nextRankAt: shouldComplete ? newRankInfo.nextRankAt : member.nextRankAt,
    pointsToNextRank: shouldComplete ? newRankInfo.pointsToNextRank : member.pointsToNextRank,
    progressPercent: shouldComplete ? newRankInfo.progressPercent : member.progressPercent,
    prestigeLevel: shouldComplete ? newPrestigeInfo.prestigeLevel : member.prestigeLevel,
    prestigeId: shouldComplete ? newPrestigeInfo.prestigeId : member.prestigeId,
    prestigeLabel: shouldComplete ? newPrestigeInfo.prestigeLabel : member.prestigeLabel,
    prestigeEmblem: shouldComplete ? newPrestigeInfo.prestigeEmblem : member.prestigeEmblem,
    nextPrestigeAt: shouldComplete ? newPrestigeInfo.nextPrestigeAt : member.nextPrestigeAt,
    nextPrestigeLabel: shouldComplete ? newPrestigeInfo.nextPrestigeLabel : member.nextPrestigeLabel,
    pointsToNextPrestige: shouldComplete ? newPrestigeInfo.pointsToNextPrestige : member.pointsToNextPrestige,
    prestigeProgressPercent: shouldComplete ? newPrestigeInfo.prestigeProgressPercent : member.prestigeProgressPercent,
    prestigeBenefits: shouldComplete ? newPrestigeInfo.prestigeBenefits : member.prestigeBenefits,
    lastMissionEvent: missionEvent,
    lastXpEvent: missionEvent || member.lastXpEvent || null,
    lastUnlockedRewards: shouldComplete ? unlockedRewardsNow : member.lastUnlockedRewards || [],
    unlockedRewards: shouldComplete
      ? [
          ...existingRewards,
          ...unlockedRewardsNow
        ]
      : existingRewards,
    xpEvents: missionEvent
      ? [...xpEvents, missionEvent].slice(-20)
      : xpEvents,
    missions: {
      ...missions,
      [mission.id]: updatedMission
    },
    updatedAt: now
  };

  saveTribeMembers(members);

  return {
    ok: true,
    completedNow: shouldComplete,
    mission: updatedMission,
    missionEvent,
    member: members[index]
  };
}

function hasPaidOrderForEmail(email = '') {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) return false;

  return loadOrders().some((order) => {
    const orderEmail = normalizeEmail(order.customerEmail);
    const status = String(order.status || '').toLowerCase();
    const paymentStatus = String(order.paymentStatus || '').toLowerCase();

    return (
      orderEmail === cleanEmail &&
      (status === 'paid' || paymentStatus === 'paid')
    );
  });
}

function syncAutomaticTribeMissionsForMember(member = {}) {
  if (!member || !member.email || member.status !== 'active') {
    return member;
  }

  let currentMember = member;

  /*
    Abrir archivo Tribe:
    se completa automáticamente al existir miembro activo.
  */
  const joinResult = completeTribeMissionForEmail({
    email: currentMember.email,
    missionId: 'join-tribe',
    reason: 'member-active'
  });

  if (joinResult.ok && joinResult.member) {
    currentMember = joinResult.member;
  }

  /*
    Primera adquisición:
    se completa si ya existe al menos un pedido pagado.
  */
  if (hasPaidOrderForEmail(currentMember.email)) {
    const orderResult = completeTribeMissionForEmail({
      email: currentMember.email,
      missionId: 'first-order',
      reason: 'paid-order-detected'
    });

    if (orderResult.ok && orderResult.member) {
      currentMember = orderResult.member;
    }
  }

  /*
    Revelar Initiate:
    se completa al tener lifetimePoints > 0.
  */
  const lifetimePoints = Number(currentMember.lifetimePoints || currentMember.points || 0);

  if (lifetimePoints > 0) {
    const initiateResult = completeTribeMissionForEmail({
      email: currentMember.email,
      missionId: 'initiate-unlocked',
      reason: 'rank-activated'
    });

    if (initiateResult.ok && initiateResult.member) {
      currentMember = initiateResult.member;
    }
  }

  return currentMember;
}
function generatePrivateRewardCode(rankId = '') {
  const cleanRank = String(rankId || 'rank').trim().toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `PP-${cleanRank}-${stamp}-${random}`;
}

function buildRankUnlockRewards({
  previousLifetimePoints = 0,
  newLifetimePoints = 0,
  existingRewards = []
} = {}) {
  const previousPoints = Math.max(0, Number(previousLifetimePoints || 0));
  const nextPoints = Math.max(previousPoints, Number(newLifetimePoints || 0));

  const alreadyUnlocked = new Set(
    existingRewards.map((reward) => String(reward.rankId || '').toLowerCase())
  );

  const now = new Date().toISOString();

  return TRIBE_RANKS
    .filter((rank) => {
      return rank.min > previousPoints && rank.min <= nextPoints;
    })
    .map((rank) => {
      const reward = rank.rewardOnUnlock;

      if (!reward || reward.type !== 'rank_discount') return null;
      if (alreadyUnlocked.has(rank.id)) return null;

      return {
        id: `reward_${rank.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        rankId: rank.id,
        rank: rank.label,
        type: 'rank_discount',
        code: generatePrivateRewardCode(rank.id),
        percent: Number(reward.percent || 0),
        minSubtotal: Number(reward.minSubtotal || 0),
        singleUse: true,
        status: 'available',
        createdAt: now,
        usedAt: null,
        usedOrderId: null
      };
    })
    .filter(Boolean);
}
function getTribeBenefitsForEmail(email = '') {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return null;
  }

  const member = findTribeMemberByEmail(cleanEmail);

  if (!member || member.status !== 'active') {
    return null;
  }

  const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
  const rankInfo = getTribeRankInfo(lifetimePoints);
  const rankConfig = getTribeRankConfig(rankInfo.rankId);

  return {
    email: cleanEmail,
    points: Number(member.points || 0),
    lifetimePoints,
    rank: rankInfo.rank,
    rankId: rankInfo.rankId,
    freeShipping: rankConfig.freeShipping || {
      enabled: false,
      minSubtotal: null
    },
    earlyAccessHours: Number(rankConfig.earlyAccessHours || 0),
    priority: rankConfig.priority || 'standard'
  };
}
/* =========================================================
   PROPHETIA · EARLY ACCESS
   Protección real de productos privados por rango Tribe
   ========================================================= */

const TRIBE_RANK_ORDER = {
  'tribe-member': 0,
  'initiate': 1,
  'adeptus': 2,
  'oracle': 3,
  'seer': 4,
  'prophet': 5
};

function normalizeRankId(rankId = '') {
  return String(rankId || '').trim().toLowerCase();
}

function hasRequiredTribeRank(userRankId = '', requiredRankId = '') {
  const userRank = normalizeRankId(userRankId);
  const requiredRank = normalizeRankId(requiredRankId);

  const userLevel = TRIBE_RANK_ORDER[userRank] ?? 0;
  const requiredLevel = TRIBE_RANK_ORDER[requiredRank] ?? 999;

  return userLevel >= requiredLevel;
}
/* =========================================================
   PROPHETIA · PRIVATE DROPS / CALENDAR ACCESS
   Fechas privadas filtradas por rango real
   ========================================================= */

const CALENDAR_RANK_ORDER = {
  'tribe-member': 0,
  'member': 0,
  'initiate': 1,
  'adeptus': 2,
  'oracle': 3,
  'seer': 4,
  'archivist': 4,
  'prophet': 5,
  'prophet-i': 6,
  'prophet-ii': 7,
  'prophet-iii': 8
};

function normalizeCalendarRankId(rankId = '') {
  return String(rankId || 'tribe-member')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function hasRequiredCalendarRank(userRankId = '', requiredRankId = 'tribe-member') {
  const userRank = normalizeCalendarRankId(userRankId);
  const requiredRank = normalizeCalendarRankId(requiredRankId);

  const userLevel = CALENDAR_RANK_ORDER[userRank] ?? 0;
  const requiredLevel = CALENDAR_RANK_ORDER[requiredRank] ?? 999;

  return userLevel >= requiredLevel;
}

function loadPrivateDrops() {
  try {
    if (!fs.existsSync(PRIVATE_DROPS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(PRIVATE_DROPS_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[private-drops] No se pudo leer private-drops.json:', err.message);
    return [];
  }
}
function loadPrivateDropPages() {
  try {
    if (!fs.existsSync(PRIVATE_DROP_PAGES_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(PRIVATE_DROP_PAGES_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[private-drop-pages] No se pudo leer private-drop-pages.json:', err.message);
    return [];
  }
}

function isPrivateDropUnlocked(drop = {}) {
  const unlockAt = drop.unlockAt ? new Date(drop.unlockAt) : null;

  if (!unlockAt || Number.isNaN(unlockAt.getTime())) {
    return false;
  }

  return Date.now() >= unlockAt.getTime();
}

function getPrivateDropAccessForMember(member = null) {
  if (!member || member.status !== 'active') {
    return null;
  }

  const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
  const rankInfo = getTribeRankInfo(lifetimePoints);
  const prestigeInfo = getTribePrestigeInfo(lifetimePoints);

  const rankId = getCalendarAccessRankId(member);

  return {
    member,
    lifetimePoints,
    rankId,
    rank: prestigeInfo.isPrestigeActive
      ? prestigeInfo.prestigeLabel
      : rankInfo.rank,
    prestige: prestigeInfo
  };
}

function sanitizePrivateDropSummary(drop = {}, access = null) {
  const requiredRankId = String(drop.requiredRankId || 'prophet');
  const hasRank = access
    ? hasRequiredCalendarRank(access.rankId, requiredRankId)
    : false;

  const unlocked = hasRank && isPrivateDropUnlocked(drop);

  return {
    id: String(drop.id || ''),
    title: String(drop.title || 'Prophet Private Drop'),
    subtitle: String(drop.subtitle || ''),
    type: String(drop.type || 'private-drop'),
    requiredRankId,
    unlockAt: String(drop.unlockAt || ''),
    status: unlocked ? 'unlocked' : String(drop.status || 'scheduled'),
    visibility: 'tribe',
    unlocked,
    hasRank,
    hero: {
      kicker: String(drop.hero?.kicker || 'PROPHET PRIVATE WINDOW'),
      title: String(drop.hero?.title || drop.title || 'Prophet Private Drop'),
      lead: String(drop.hero?.lead || '')
    },
    media: {
      cover: String(drop.media?.cover || '')
    },
    cta: {
      label: unlocked ? 'Entrar al drop' : 'Acceso programado',
      href: `/prophet-private?id=${encodeURIComponent(String(drop.id || ''))}`
    }
  };
}

function sanitizePrivateDropDetail(drop = {}) {
  return {
    id: String(drop.id || ''),
    title: String(drop.title || 'Prophet Private Drop'),
    subtitle: String(drop.subtitle || ''),
    type: String(drop.type || 'private-drop'),
    requiredRankId: String(drop.requiredRankId || 'prophet'),
    unlockAt: String(drop.unlockAt || ''),
    status: 'unlocked',
    visibility: 'tribe',
    hero: {
      kicker: String(drop.hero?.kicker || 'PROPHET PRIVATE WINDOW'),
      title: String(drop.hero?.title || drop.title || 'Prophet Private Drop'),
      lead: String(drop.hero?.lead || '')
    },
    story: Array.isArray(drop.story)
      ? drop.story.map((item) => String(item || ''))
      : [],
    benefits: Array.isArray(drop.benefits)
      ? drop.benefits.map((item) => String(item || ''))
      : [],
    products: Array.isArray(drop.products)
      ? drop.products.map((product) => ({
          id: String(product.id || ''),
          title: String(product.title || ''),
          description: String(product.description || ''),
          requiredRankId: String(product.requiredRankId || drop.requiredRankId || 'prophet'),
          price: Number(product.price || 0),
          currency: String(product.currency || 'EUR'),
          status: String(product.status || 'preview'),
          href: String(product.href || ''),
          image: String(product.image || ''),
          cta: String(product.cta || 'Ver pieza')
        }))
      : [],
    media: {
      cover: String(drop.media?.cover || ''),
      gallery: Array.isArray(drop.media?.gallery)
        ? drop.media.gallery.map((item) => String(item || ''))
        : []
    },
    cta: {
      label: String(drop.cta?.label || 'Explorar drop privado'),
      href: String(drop.cta?.href || '/prophet-private')
    }
  };
}
function getCalendarAccessRankId(member = null) {
  if (!member || member.status !== 'active') {
    return 'tribe-member';
  }

  const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
  const prestigeInfo = getTribePrestigeInfo(lifetimePoints);

  if (prestigeInfo.isPrestigeActive && prestigeInfo.prestigeId) {
    return prestigeInfo.prestigeId;
  }

  const rankInfo = getTribeRankInfo(lifetimePoints);
  return rankInfo.rankId || 'tribe-member';
}

function isEarlyAccessStillLocked(product = {}) {
  const early = product.earlyAccess;

  if (!early || early.enabled !== true) {
    return false;
  }

  const publicReleaseAt = early.publicReleaseAt
    ? new Date(early.publicReleaseAt)
    : null;

  if (!publicReleaseAt || Number.isNaN(publicReleaseAt.getTime())) {
    return true;
  }

  return Date.now() < publicReleaseAt.getTime();
}

function assertEarlyAccessAllowed(product = {}, tribeBenefits = null) {
  const early = product.earlyAccess;

  if (!early || early.enabled !== true) {
    return;
  }

  if (!isEarlyAccessStillLocked(product)) {
    return;
  }

  const requiredRankId = normalizeRankId(early.requiredRankId || 'adeptus');
  const userRankId = normalizeRankId(tribeBenefits?.rankId || 'tribe-member');

  if (!tribeBenefits || !hasRequiredTribeRank(userRankId, requiredRankId)) {
    const requiredLabel =
      getTribeRankConfig(requiredRankId)?.label ||
      requiredRankId ||
      'Tribe';

    throw new Error(
      `Esta pieza está en Early Access. Necesitas rango ${requiredLabel} o superior para comprarla antes del lanzamiento público.`
    );
  }
}
function getRankByPoints(points = 0) {
  const value = Math.max(0, Number(points || 0));
  let current = TRIBE_RANKS[0];

  for (const rank of TRIBE_RANKS) {
    if (value >= rank.min) current = rank;
  }

  return current;
}

function getNextRankByRankId(rankId = '') {
  const index = TRIBE_RANKS.findIndex((rank) => rank.id === rankId);
  return index >= 0 ? TRIBE_RANKS[index + 1] || null : null;
}
function getPrestigeLevelByPoints(points = 0) {
  const value = Math.max(0, Number(points || 0));

  if (value < 1000) return null;

  let current = TRIBE_PRESTIGE_LEVELS[0];

  for (const level of TRIBE_PRESTIGE_LEVELS) {
    if (value >= level.min) {
      current = level;
    }
  }

  return current;
}

function getNextPrestigeByLevelId(levelId = '') {
  const index = TRIBE_PRESTIGE_LEVELS.findIndex((level) => level.id === levelId);
  return index >= 0 ? TRIBE_PRESTIGE_LEVELS[index + 1] || null : null;
}
function buildXpAnimationSteps(previousLifetimePoints = 0, newLifetimePoints = 0) {
  const steps = [];
  let cursor = Math.max(0, Number(previousLifetimePoints || 0));
  const target = Math.max(cursor, Number(newLifetimePoints || 0));

  while (cursor < target) {
    /*
      Antes de Prophet: progresión normal de rangos.
    */
    if (cursor < 1000) {
      const rank = getRankByPoints(cursor);
      const nextRank = getNextRankByRankId(rank.id);

      const rankStart = rank.min;
      const rankEnd = nextRank ? nextRank.min : 1000;
      const segmentEnd = Math.min(rankEnd, target);
      const rankSize = Math.max(1, rankEnd - rankStart);

      const fromInRank = Math.max(0, cursor - rankStart);
      const toInRank = Math.max(0, segmentEnd - rankStart);

      steps.push({
        type: 'fill',
        rank: rank.label,
        rankId: rank.id,
        nextRank: nextRank ? nextRank.label : null,
        fromPercent: Math.round((fromInRank / rankSize) * 100),
        toPercent: Math.round((toInRank / rankSize) * 100),
        fromText: `${fromInRank} / ${rankSize} LP`,
toText: `${toInRank} / ${rankSize} LP`
      });

      cursor = segmentEnd;

      if (cursor < target && nextRank) {
        steps.push({
          type: 'level-up',
          fromRank: rank.label,
          toRank: nextRank.label
        });
      }

      continue;
    }

    /*
      Después de Prophet: progresión de prestigio.
      Prophet nunca se pierde. La barra mide el emblema de prestigio.
    */
    const prestige = getPrestigeLevelByPoints(cursor);
    const nextPrestige = prestige ? getNextPrestigeByLevelId(prestige.id) : null;

    if (!prestige) break;

    const prestigeStart = prestige.min;
    const prestigeEnd = nextPrestige ? nextPrestige.min : target;
    const segmentEnd = Math.min(prestigeEnd, target);
    const prestigeSize = Math.max(1, prestigeEnd - prestigeStart);

    const fromInPrestige = Math.max(0, cursor - prestigeStart);
    const toInPrestige = Math.max(0, segmentEnd - prestigeStart);

    steps.push({
      type: 'fill',
      rank: 'Prophet',
      rankId: 'prophet',
      prestigeId: prestige.id,
      prestigeLevel: prestige.level,
      prestigeLabel: prestige.label,
      nextRank: nextPrestige ? nextPrestige.label : null,
      nextPrestigeLabel: nextPrestige ? nextPrestige.label : null,
      fromPercent: Math.round((fromInPrestige / prestigeSize) * 100),
      toPercent: Math.round((toInPrestige / prestigeSize) * 100),
      fromText: `${cursor} / ${prestigeEnd} LP`,
toText: `${segmentEnd} / ${prestigeEnd} LP`
    });

    cursor = segmentEnd;

    if (cursor < target && nextPrestige) {
      steps.push({
        type: 'prestige-up',
        fromPrestige: prestige.label || 'Prophet',
        toPrestige: nextPrestige.label,
        toRank: 'Prophet'
      });
    }
  }

  return steps;
}
function calculatePointsForOrder(order = {}) {
  const subtotal = Number(order.subtotal || 0);
  const discountAmount = Number(order.discount?.amount || 0);

  const eligibleAmount = Math.max(0, subtotal - discountAmount);
  return Math.floor(eligibleAmount * TRIBE_POINTS_PER_EURO);
}

async function addTribePointsForPaidOrder(orderInput = {}) {
  const order = findOrderByDraftId(orderInput.orderDraftId) || orderInput;

  if (!order || !order.orderDraftId) return null;

  if (order.tribePointsAppliedAt) {
    return order.tribeXpEvent || null;
  }

  const email = normalizeEmail(order.customerEmail);

  if (!email || !isValidEmail(email)) return null;

  const members = loadTribeMembers();
  const index = members.findIndex((member) => normalizeEmail(member.email) === email);

  if (index < 0) return null;

  const member = members[index];

  if (member.status !== 'active') return null;

  const pointsEarned = calculatePointsForOrder(order);

  if (pointsEarned <= 0) return null;

  const previousPoints = Number(member.points || 0);
  const previousLifetimePoints = Number(member.lifetimePoints || member.points || 0);

const previousRankInfo = getTribeRankInfo(previousLifetimePoints);
const previousPrestigeInfo = getTribePrestigeInfo(previousLifetimePoints);
const newPoints = previousPoints + pointsEarned;
const newLifetimePoints = previousLifetimePoints + pointsEarned;

const initiationUnlocked =
  previousLifetimePoints <= 0 &&
  newLifetimePoints > 0;

  const newRankInfo = getTribeRankInfo(newLifetimePoints);
  const newPrestigeInfo = getTribePrestigeInfo(newLifetimePoints);

  const xpEvents = Array.isArray(member.xpEvents)
    ? member.xpEvents
    : [];

  const existingRewards = Array.isArray(member.unlockedRewards)
    ? member.unlockedRewards
    : [];

  const unlockedRewardsNow = buildRankUnlockRewards({
    previousLifetimePoints,
    newLifetimePoints,
    existingRewards
  });

  const xpEvent = {
    orderId: order.orderNumber || order.orderDraftId,
    orderDraftId: order.orderDraftId,
    email,
    pointsEarned,
    previousPoints,
    newPoints,
    previousLifetimePoints,
    newLifetimePoints,
previousPrestige: previousPrestigeInfo,
newPrestige: newPrestigeInfo,
prestigeUnlocked:
  previousPrestigeInfo.prestigeLevel !== newPrestigeInfo.prestigeLevel,
prestigeLabel: newPrestigeInfo.prestigeLabel,
nextPrestigeLabel: newPrestigeInfo.nextPrestigeLabel,
pointsToNextPrestige: newPrestigeInfo.pointsToNextPrestige,
prestigeProgressPercent: newPrestigeInfo.prestigeProgressPercent,
    previousRank: previousRankInfo.rank,
    newRank: newRankInfo.rank,
    nextRank: newRankInfo.nextRank,
    nextRankAt: newRankInfo.nextRankAt,
    pointsToNextRank: newRankInfo.pointsToNextRank,

    previousProgressPercent: previousRankInfo.progressPercent,
    newProgressPercent: newRankInfo.progressPercent,
leveledUp: previousRankInfo.rank !== newRankInfo.rank,
initiationUnlocked,
xpAnimationSteps: buildXpAnimationSteps(previousLifetimePoints, newLifetimePoints),
unlockedRewards: unlockedRewardsNow,
createdAt: new Date().toISOString()
  };

  members[index] = {
    ...member,
    points: newPoints,
    lifetimePoints: newLifetimePoints,
    rank: newRankInfo.rank,
    rankId: newRankInfo.rankId,
    nextRank: newRankInfo.nextRank,
    nextRankAt: newRankInfo.nextRankAt,
    pointsToNextRank: newRankInfo.pointsToNextRank,
    progressPercent: newRankInfo.progressPercent,
    pointsRequiredForNextDiscount: TRIBE_POINTS_REDEEM_COST,
    lastXpEvent: xpEvent,
    prestigeLevel: newPrestigeInfo.prestigeLevel,
prestigeId: newPrestigeInfo.prestigeId,
prestigeLabel: newPrestigeInfo.prestigeLabel,
prestigeEmblem: newPrestigeInfo.prestigeEmblem,
nextPrestigeAt: newPrestigeInfo.nextPrestigeAt,
nextPrestigeLabel: newPrestigeInfo.nextPrestigeLabel,
pointsToNextPrestige: newPrestigeInfo.pointsToNextPrestige,
prestigeProgressPercent: newPrestigeInfo.prestigeProgressPercent,
prestigeBenefits: newPrestigeInfo.prestigeBenefits,
    lastUnlockedRewards: unlockedRewardsNow,
    unlockedRewards: [
      ...existingRewards,
      ...unlockedRewardsNow
    ],
    xpEvents: [...xpEvents, xpEvent].slice(-20),
    updatedAt: new Date().toISOString()
  };
  const currentMissions = normalizeMemberMissions(member);

  const firstOrderMission = currentMissions['first-order'] || null;
  const initiateMission = currentMissions['initiate-unlocked'] || null;

  const firstOrderCompletedNow = firstOrderMission && !firstOrderMission.completed;
  const initiateCompletedNow = initiateMission && !initiateMission.completed;

  const nowMission = new Date().toISOString();

  members[index].missions = {
    ...currentMissions,

    'first-order': {
      ...currentMissions['first-order'],
      progress: 1,
      status: 'completed',
      completed: true,
      completedAt: firstOrderMission?.completedAt || nowMission,
      pointsAppliedAt: firstOrderMission?.pointsAppliedAt || null,
      updatedAt: nowMission
    },

    'initiate-unlocked': {
      ...currentMissions['initiate-unlocked'],
      progress: 1,
      status: 'completed',
      completed: true,
      completedAt: initiateMission?.completedAt || nowMission,
      pointsAppliedAt: initiateMission?.pointsAppliedAt || null,
      updatedAt: nowMission
    }
  };

  xpEvent.completedMissions = [
    firstOrderCompletedNow ? 'first-order' : '',
    initiateCompletedNow ? 'initiate-unlocked' : ''
  ].filter(Boolean);
  saveTribeMembers(members);

  const orderWithXp = {
    ...order,
    tribePointsAppliedAt: new Date().toISOString(),
    tribePointsEarned: pointsEarned,
    tribeXpEvent: xpEvent
  };

  upsertOrder(orderWithXp);

  if (unlockedRewardsNow.length) {
    try {
      const emailSent = await sendTribeRankRewardEmail({
        member: members[index],
        rewards: unlockedRewardsNow,
        xpEvent
      });

      if (emailSent) {
        upsertOrder({
          ...orderWithXp,
          tribeRewardEmailSentAt: new Date().toISOString(),
          tribeRewardEmailCodes: unlockedRewardsNow.map((reward) => reward.code)
        });
      }
    } catch (err) {
      console.error('[tribe-rank-email] error:', err);

      upsertOrder({
        ...orderWithXp,
        tribeRewardEmailError: err.message || 'No se pudo enviar el email de recompensa.'
      });
    }
  }

  console.log('[tribe-xp] puntos añadidos:', email, pointsEarned);

  return xpEvent;
}

function applyDiscountToSummary(summary, discountResult) {
  const discount = discountResult?.valid ? discountResult : null;
  const discountAmount = discount ? Number(discount.amount || 0) : 0;

  return {
    ...summary,
discount: discount
  ? {
      code: discount.code,
      type: discount.type || '',
      rewardId: discount.rewardId || null,
      rankId: discount.rankId || '',
      rank: discount.rank || '',
      percent: discount.percent,
      amount: discountAmount,
      minSubtotal: discount.minSubtotal || null
    }
  : null,
    total: roundMoney(Number(summary.total || 0) - discountAmount)
  };
}

function buildTribeWelcomeEmail(member) {
  return `
    <div style="margin:0;padding:0;background:#fdfaf6;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:680px;margin:0 auto;padding:42px 24px;">
        <div style="text-align:center;margin-bottom:38px;">
          <h1 style="font-family:Georgia,serif;font-size:44px;letter-spacing:-1px;margin:0;">
            PROPHETIA
          </h1>
        </div>

        <div style="background:#fff;border:1px solid #eee;border-radius:22px;padding:34px;">
          <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#777;margin:0 0 18px;">
            Prophetia Tribe
          </p>

          <h2 style="font-family:Georgia,serif;font-size:34px;line-height:1.05;margin:0 0 18px;">
            Bienvenido/a a la Tribe
          </h2>

          <p style="line-height:1.7;color:#555;margin:0 0 24px;">
            Ya formas parte del acceso privado de Prophetia. Usa tu código exclusivo en checkout.
          </p>

          <div style="border:1px solid #111;border-radius:14px;padding:18px;text-align:center;margin:24px 0;">
            <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#777;margin:0 0 8px;">
              Código privado
            </p>
            <strong style="font-size:28px;letter-spacing:2px;">${TRIBE_DISCOUNT_CODE}</strong>
          </div>

          <p style="line-height:1.7;color:#555;margin:0;">
            10% de descuento en pedidos desde 40 €. No acumulable con otros códigos.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendTribeWelcomeEmail(member) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[tribe] RESEND_API_KEY no configurada.');
    return;
  }

  const from = process.env.ORDER_FROM_EMAIL || 'Prophetia <onboarding@resend.dev>';

  try {
    await resend.emails.send({
      from,
      to: member.email,
      subject: `Tu acceso Prophetia Tribe — ${TRIBE_DISCOUNT_CODE}`,
      html: buildTribeWelcomeEmail(member)
    });

    console.log('[tribe] email enviado:', member.email);
  } catch (err) {
    console.error('[tribe] error enviando email:', err);
  }
}
function buildRankRewardRows(rewards = []) {
  return rewards.map((reward) => {
    const rank = escapeHtml(reward.rank || 'Tribe');
    const code = escapeHtml(String(reward.code || '').trim().toUpperCase());
    const percent = Number(reward.percent || 0);
    const minSubtotal = Number(reward.minSubtotal || 0);

    return `
      <div style="border:1px solid #111;border-radius:18px;padding:20px;margin:18px 0;background:#fff;">
        <p style="font-size:11px;letter-spacing:2.8px;text-transform:uppercase;color:#8a6727;margin:0 0 8px;">
          ${rank} Reward
        </p>

        <h3 style="font-family:Georgia,serif;font-size:28px;line-height:1.05;margin:0 0 14px;font-weight:400;">
          Recompensa privada — ${percent}%
        </h3>

        <div style="border:1px solid #e8e0d2;background:#fdfaf6;border-radius:14px;padding:16px;text-align:center;margin:16px 0;">
          <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#777;margin:0 0 8px;">
            Código desbloqueado
          </p>
          <strong style="font-size:20px;letter-spacing:1.4px;">${code}</strong>
        </div>

        <p style="line-height:1.65;color:#555;margin:0;font-size:14px;">
          Válido una sola vez en pedidos desde ${minSubtotal} €. No acumulable con otros códigos Prophetia Tribe.
        </p>
      </div>
    `;
  }).join('');
}

function buildTribeRankRewardEmail({ member = {}, rewards = [], xpEvent = {} } = {}) {
  const safeName = escapeHtml(member.name || 'Prophetia Member');
  const mainReward = rewards[rewards.length - 1] || {};
  const rank = escapeHtml(mainReward.rank || xpEvent.newRank || 'Prophetia Tribe');
  const accountUrl = `${SITE_URL}/my-content.html`;

  return `
    <div style="margin:0;padding:0;background:#fdfaf6;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:720px;margin:0 auto;padding:44px 24px;">
        <div style="text-align:center;margin-bottom:42px;">
          <h1 style="font-family:Georgia,serif;font-size:44px;letter-spacing:-1px;margin:0;">
            PROPHETIA
          </h1>
          <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#777;margin:10px 0 0;">
            Prophetia Tribe
          </p>
        </div>

        <div style="background:#fff;border:1px solid #eee;border-radius:26px;padding:36px;">
          <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8a6727;margin:0 0 18px;">
            Nuevo rango desbloqueado
          </p>

          <h2 style="font-family:Georgia,serif;font-size:38px;line-height:1.02;margin:0 0 18px;font-weight:400;">
            Has alcanzado ${rank}
          </h2>

          <p style="line-height:1.75;color:#555;margin:0 0 22px;">
            ${safeName}, tu archivo personal dentro de Prophetia Tribe ha evolucionado. 
            Has desbloqueado una recompensa privada asociada a tu nuevo rango.
          </p>

          ${buildRankRewardRows(rewards)}

          <div style="margin-top:28px;text-align:center;">
            <a href="${accountUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">
              Ver mi archivo Tribe
            </a>
          </div>

          <p style="margin:28px 0 0;color:#777;font-size:13px;line-height:1.65;">
            Esta recompensa queda disponible en tu cuenta Prophetia y podrá usarse en checkout mientras aparezca como disponible.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendTribeRankRewardEmail({ member = {}, rewards = [], xpEvent = {} } = {}) {
  const cleanRewards = Array.isArray(rewards)
    ? rewards.filter((reward) => reward?.type === 'rank_discount' && reward.code)
    : [];

  if (!cleanRewards.length) {
    return false;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[tribe-rank-email] RESEND_API_KEY no configurada.');
    return false;
  }

  if (!member.email || !isValidEmail(member.email)) {
    console.warn('[tribe-rank-email] email no válido:', member.email);
    return false;
  }

  const from = process.env.ORDER_FROM_EMAIL || 'Prophetia <onboarding@resend.dev>';
  const mainReward = cleanRewards[cleanRewards.length - 1];
  const subject = `Has alcanzado ${mainReward.rank} — recompensa privada Prophetia`;

  await resend.emails.send({
    from,
    to: member.email,
    subject,
    html: buildTribeRankRewardEmail({
      member,
      rewards: cleanRewards,
      xpEvent
    })
  });

  console.log('[tribe-rank-email] enviado:', member.email, cleanRewards.map((reward) => reward.code).join(', '));

  return true;
}

function ensureOrdersFile() {
  if (!fs.existsSync(ORDERS_DIR)) {
    fs.mkdirSync(ORDERS_DIR, { recursive: true });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
  }
}

function loadOrders() {
  ensureOrdersFile();

  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  ensureOrdersFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}
function formatMoney(value = 0, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency
  }).format(Number(value || 0));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildOrderItemsHtml(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) {
    return '<p>No hay artículos registrados.</p>';
  }

  return items.map((item) => {
    const qty = Number(item.qty || 1);
    const lineTotal = Number(item.lineTotal || item.unitPrice * qty || 0);

    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eee;">
          <strong>${escapeHtml(item.title || 'Pieza Prophetia')}</strong><br>
          <span style="color:#666;font-size:13px;">
            ${item.color ? `Color: ${escapeHtml(item.color)} · ` : ''}
            ${item.size ? `Talla: ${escapeHtml(item.size)} · ` : ''}
            Cantidad: ${qty}
          </span>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #eee;text-align:right;">
          ${formatMoney(lineTotal, order.currency || 'EUR')}
        </td>
      </tr>
    `;
  }).join('');
}

function buildCustomerOrderEmail(order) {
  const currency = order.currency || 'EUR';
  const orderNumber = order.orderNumber || order.orderDraftId;

  return `
    <div style="margin:0;padding:0;background:#fdfaf6;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:680px;margin:0 auto;padding:42px 24px;">
        <div style="text-align:center;margin-bottom:42px;">
          <h1 style="font-family:Georgia,serif;font-size:44px;letter-spacing:-1px;margin:0;">
            PROPHETIA
          </h1>
        </div>

        <div style="background:#fff;border:1px solid #eee;border-radius:22px;padding:34px;">
          <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#777;margin:0 0 18px;">
            Pedido confirmado
          </p>

          <h2 style="font-family:Georgia,serif;font-size:34px;line-height:1.05;margin:0 0 18px;">
            Gracias por tu pedido
          </h2>

          <p style="line-height:1.7;color:#555;margin:0 0 28px;">
            Hemos recibido correctamente tu pedido. Prepararemos tus piezas Prophetia y te avisaremos cuando avance el estado del envío.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #111;border-bottom:1px solid #eee;margin-bottom:28px;">
            <tr>
              <td style="padding:12px 0;color:#777;">Número de pedido</td>
              <td style="padding:12px 0;text-align:right;font-weight:bold;">${escapeHtml(orderNumber)}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:#777;">Estado</td>
              <td style="padding:12px 0;text-align:right;font-weight:bold;">Pagado</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:#777;">Entrega estimada</td>
              <td style="padding:12px 0;text-align:right;font-weight:bold;">${escapeHtml(order.estimatedDelivery || order.shippingRate?.estimatedDelivery || '2–7 días laborables')}</td>
            </tr>
          </table>

          <h3 style="font-family:Georgia,serif;font-size:22px;margin:0 0 10px;">
            Resumen
          </h3>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${buildOrderItemsHtml(order)}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr>
              <td style="padding:8px 0;color:#777;">Subtotal</td>
              <td style="padding:8px 0;text-align:right;">${formatMoney(order.subtotal, currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#777;">Envío</td>
              <td style="padding:8px 0;text-align:right;">${Number(order.shipping || 0) > 0 ? formatMoney(order.shipping, currency) : 'Gratis'}</td>
            </tr>
            <tr>
              <td style="padding:14px 0;border-top:1px solid #111;font-weight:bold;">Total</td>
              <td style="padding:14px 0;border-top:1px solid #111;text-align:right;font-weight:bold;">
                ${formatMoney(order.total || order.amountTotal, currency)}
              </td>
            </tr>
          </table>

          <p style="margin:30px 0 0;color:#777;font-size:13px;line-height:1.6;">
            Si tienes cualquier duda, contacta con Prophetia.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildInternalOrderEmail(order) {
  const currency = order.currency || 'EUR';
  const orderNumber = order.orderNumber || order.orderDraftId;
  const shipping = order.shippingDetails || {};

  return `
    <div style="font-family:Arial,sans-serif;color:#111;">
      <h1>Nuevo pedido pagado</h1>

      <p><strong>Pedido:</strong> ${escapeHtml(orderNumber)}</p>
      <p><strong>Email cliente:</strong> ${escapeHtml(order.customerEmail || '')}</p>
      <p><strong>Total:</strong> ${formatMoney(order.total || order.amountTotal, currency)}</p>

      <h2>Productos</h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${buildOrderItemsHtml(order)}
      </table>

      <h2>Dirección de envío</h2>
      <p>
        ${escapeHtml(shipping.firstName || '')} ${escapeHtml(shipping.lastName || '')}<br>
        ${escapeHtml(shipping.address1 || '')}<br>
        ${shipping.address2 ? `${escapeHtml(shipping.address2)}<br>` : ''}
        ${escapeHtml(shipping.postalCode || '')} ${escapeHtml(shipping.city || '')}<br>
        ${escapeHtml(shipping.state || '')}, ${escapeHtml(shipping.country || '')}<br>
        Tel: ${escapeHtml(shipping.phone || '')}
      </p>
    </div>
  `;
}

async function sendOrderEmailsOnce(orderInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurada.');
    return;
  }

  const currentOrder = findOrderByDraftId(orderInput.orderDraftId) || orderInput;

  if (currentOrder.customerEmailSentAt) {
    console.log('[email] ya enviado para:', currentOrder.orderNumber || currentOrder.orderDraftId);
    return;
  }

  const from = process.env.ORDER_FROM_EMAIL || 'Prophetia <onboarding@resend.dev>';
  const internalEmail = process.env.ORDER_INTERNAL_EMAIL || '';
  const orderNumber = currentOrder.orderNumber || currentOrder.orderDraftId;

  try {
    if (currentOrder.customerEmail) {
      await resend.emails.send({
        from,
        to: currentOrder.customerEmail,
        subject: `Pedido confirmado — ${orderNumber}`,
        html: buildCustomerOrderEmail(currentOrder)
      });
    }

    if (internalEmail) {
      await resend.emails.send({
        from,
        to: internalEmail,
        subject: `Nuevo pedido pagado — ${orderNumber}`,
        html: buildInternalOrderEmail(currentOrder)
      });
    }

    upsertOrder({
      ...currentOrder,
      customerEmailSentAt: new Date().toISOString(),
      internalEmailSentAt: internalEmail ? new Date().toISOString() : currentOrder.internalEmailSentAt || null
    });

    console.log('[email] enviados para:', orderNumber);
  } catch (err) {
    console.error('[email] error enviando emails:', err);
  }
}
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const orders = loadOrders();

  const sameYearOrders = orders.filter((order) => {
    return String(order.orderNumber || '').includes(`PROPHETIA-${year}-`);
  });

  const nextNumber = sameYearOrders.length + 1;

  return `PROPHETIA-${year}-${String(nextNumber).padStart(4, '0')}`;
}
function upsertOrder(order) {
  const orders = loadOrders();
  const index = orders.findIndex((item) => item.orderDraftId === order.orderDraftId);

  if (index >= 0) {
    orders[index] = {
      ...orders[index],
      ...order,
      updatedAt: new Date().toISOString()
    };
  } else {
    orders.push({
      ...order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveOrders(orders);
}

function findOrderBySessionId(sessionId) {
  const cleanSessionId = String(sessionId || '').trim();
  if (!cleanSessionId) return null;

  return loadOrders().find((order) => order.stripeSessionId === cleanSessionId) || null;
}

function findOrderByDraftId(orderDraftId) {
  const cleanOrderDraftId = String(orderDraftId || '').trim();
  if (!cleanOrderDraftId) return null;

  return loadOrders().find((order) => order.orderDraftId === cleanOrderDraftId) || null;
}
function getBearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function requireFirebaseUser(req, res, next) {
  try {
    if (!admin.apps.length) {
      return res.status(500).json({
        error: 'Firebase Admin no está inicializado en el servidor.'
      });
    }

    const idToken = getBearerToken(req);

    if (!idToken) {
      return res.status(401).json({
        error: 'Sesión no válida. Inicia sesión de nuevo.'
      });
    }

    const decodedToken = await getAuth().verifyIdToken(idToken);

    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({
        error: 'Token de usuario inválido.'
      });
    }

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: String(decodedToken.email || '').trim().toLowerCase(),
      emailVerified: !!decodedToken.email_verified
    };

if (!req.firebaseUser.email) {
  return res.status(403).json({
    error: 'Tu cuenta no tiene un email válido asociado.'
  });
}

if (!req.firebaseUser.emailVerified) {
  return res.status(403).json({
    error: 'Verifica tu correo antes de continuar.'
  });
}

return next();
  } catch (err) {
    console.error('[auth] Firebase token inválido:', err.message);

    return res.status(401).json({
      error: 'Sesión caducada. Vuelve a iniciar sesión.'
    });
  }
}

async function getOptionalFirebaseUser(req) {
  try {
    if (!admin.apps.length) return null;

    const idToken = getBearerToken(req);
    if (!idToken) return null;

    const decodedToken = await getAuth().verifyIdToken(idToken);

    if (!decodedToken || !decodedToken.uid) {
      return null;
    }

    const email = normalizeEmail(decodedToken.email || '');

if (!email || !isValidEmail(email)) {
  return null;
}

if (!decodedToken.email_verified) {
  return null;
}

return {
  uid: decodedToken.uid,
  email,
  emailVerified: true
};
  } catch (err) {
    console.warn('[auth optional] Firebase token no válido:', err.message);
    return null;
  }
}
const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_PATH = path.join(PUBLIC_DIR, 'assets', 'data', 'catalog.json');

/* =========================================================
   STRIPE WEBHOOK · Confirmación real de pago

   PRODUCCIÓN:
   - Endpoint en Stripe Dashboard:
       https://prophetia.es/api/stripe-webhook
   - Usar STRIPE_WEBHOOK_SECRET real: whsec_...
   - Este bloque debe ir SIEMPRE antes de express.json().
   - En local puede probarse con Stripe CLI.
   ========================================================= */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
const signature = req.headers['stripe-signature'];
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const isLocal =
  SITE_URL.includes('127.0.0.1') ||
  SITE_URL.includes('localhost');

let event;

try {
  if (!webhookSecret) {
    if (!isLocal) {
      console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET vacío en entorno no local.');

      return res.status(500).json({
        error: 'Stripe webhook no configurado.'
      });
    }

    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET vacío. Solo permitido en local.');
    event = JSON.parse(req.body.toString('utf8'));
  } else {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  }
} catch (err) {
  console.error('[stripe-webhook] firma inválida:', err.message);
  return res.status(400).send(`Webhook Error: ${err.message}`);
}

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderDraftId = session.metadata?.orderDraftId || null;

      if (!orderDraftId) {
        console.warn('[stripe-webhook] sesión sin orderDraftId:', session.id);
        return res.json({ received: true });
      }

      const currentOrder = findOrderByDraftId(orderDraftId);

const paidOrder = {
  ...(currentOrder || {}),
  orderDraftId,
  stripeSessionId: session.id,
  stripePaymentIntentId: session.payment_intent || null,
  status: 'paid',
  paymentStatus: session.payment_status || 'paid',
  customerEmail: session.customer_email || currentOrder?.customerEmail || '',
  amountTotal: Number(session.amount_total || 0) / 100,
  currency: String(session.currency || 'eur').toUpperCase(),
  paidAt: new Date().toISOString()
};

upsertOrder(paidOrder);
await finalizePaidOrderOnce(paidOrder);

console.log('[stripe-webhook] pedido pagado:', orderDraftId);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] error procesando evento:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],

  scriptSrc: [
  "'self'",
  process.env.NODE_ENV === "development" ? "'unsafe-inline'" : "",
  "https://js.stripe.com",
  "https://www.gstatic.com",
  "https://www.googleapis.com",
  "https://apis.google.com",
  "https://maps.googleapis.com"
].filter(Boolean),

scriptSrcAttr: [
  process.env.NODE_ENV === "development" ? "'unsafe-inline'" : "'none'"
],

      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firestore.googleapis.com",
        "https://firebaseinstallations.googleapis.com"
      ],

frameSrc: [
  "'self'",
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://accounts.google.com",
  "https://*.firebaseapp.com",
  "https://*.web.app",
  "https://prophetia.es",
  "https://www.prophetia.es"
],

childSrc: [
  "'self'",
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://accounts.google.com",
  "https://*.firebaseapp.com",
  "https://*.web.app",
  "https://prophetia.es",
  "https://www.prophetia.es"
],

      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:"
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],

      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],

      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'", "https://checkout.stripe.com"]
    }
  },

  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,

  hsts: process.env.NODE_ENV === 'production'
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false
      }
    : false
}));
app.disable('x-powered-by');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes. Espera unos minutos y vuelve a intentarlo.'
  }
});

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de checkout. Espera unos minutos.'
  }
});

const authSensitiveLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.'
  }
});

app.use('/api/cart-summary', apiLimiter);
app.use('/api/discount/validate', authSensitiveLimiter);
app.use('/api/tribe/subscribe', authSensitiveLimiter);
app.use('/api/create-checkout-session', checkoutLimiter);
app.use('/api/my-orders', authSensitiveLimiter);
app.use('/api/tribe/me', authSensitiveLimiter);
app.use('/api/tribe/mission/check', authSensitiveLimiter);
app.use('/api/drops/private', authSensitiveLimiter);
app.use('/api/private-drops', authSensitiveLimiter);
app.use(express.json({ limit: '80kb' }));
/*
  PRODUCCIÓN:
  - Para activar caché real de assets:
      NODE_ENV=production
      SITE_URL=https://prophetia.es

  - Si NODE_ENV no es "production", el servidor desactiva caché
    para que los cambios locales se vean al instante.
*/
const isLocalDev =
  SITE_URL.includes('127.0.0.1') ||
  SITE_URL.includes('localhost') ||
  process.env.NODE_ENV !== 'production';
/*
  PRODUCCIÓN:
  - En local: Cache-Control no-store para evitar caché durante desarrollo.
  - En producción: caché básica para JS/CSS/imágenes/fuentes.
  - Si se usa Cloudflare/CDN, se podrán subir tiempos de caché.
*/
app.use(express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: false,
  maxAge: isLocalDev ? 0 : '1h',
  etag: !isLocalDev,
  lastModified: !isLocalDev,
  setHeaders(res, filePath) {
    if (isLocalDev) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      return;
    }

    if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));
async function finalizePaidOrderOnce(orderInput = {}) {
  const order = findOrderByDraftId(orderInput.orderDraftId) || orderInput;

  if (!order || !order.orderDraftId) return orderInput;

  const isPaid = order.status === 'paid' || order.paymentStatus === 'paid';
  if (!isPaid) return order;

 try {
  deductStockForOrderOnce(order);
} catch (err) {
  console.warn('[finalize] stock:', err.message);

  upsertOrder({
    ...order,
    fulfillmentStatus: 'manual_review',
    stockError: err.message || 'Error descontando stock.',
    stockErrorAt: new Date().toISOString()
  });

  return findOrderByDraftId(order.orderDraftId) || order;
}

  try {
    await sendOrderEmailsOnce(order);
  } catch (err) {
    console.warn('[finalize] email:', err.message);
  }

if (order.discount?.code) {
  markTribeDiscountUsed({
    email: order.customerEmail,
    code: order.discount.code,
    orderId: order.orderNumber || order.orderDraftId
  });
}

  await addTribePointsForPaidOrder(order);
upsertOrder({
  ...(findOrderByDraftId(order.orderDraftId) || order),
  finalizedAt: new Date().toISOString(),
  fulfillmentStatus: 'paid_confirmed'
});
  return findOrderByDraftId(order.orderDraftId) || order;
}
function loadCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : data.items || [];
}
function buildInitialStockFromCatalog() {
  const catalog = loadCatalog();
  const stock = {};

  catalog.forEach((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];

    variants.forEach((variant) => {
      const sku = String(variant.sku || '').trim();
      if (!sku) return;

      stock[sku] = {
        sku,
        productId: product.id || '',
        title: product.title || '',
        color: variant.color || '',
        size: variant.size || '',
        stock: Math.max(0, Number(variant.stock || 0)),
        updatedAt: new Date().toISOString()
      };
    });
  });

  return stock;
}

function ensureStockFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STOCK_FILE)) {
    const initialStock = buildInitialStockFromCatalog();
    fs.writeFileSync(STOCK_FILE, JSON.stringify(initialStock, null, 2), 'utf8');
    return;
  }

  try {
    const raw = fs.readFileSync(STOCK_FILE, 'utf8');
    const current = JSON.parse(raw || '{}');

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      const initialStock = buildInitialStockFromCatalog();
      fs.writeFileSync(STOCK_FILE, JSON.stringify(initialStock, null, 2), 'utf8');
      return;
    }

    // Añade SKUs nuevos del catálogo sin pisar stock existente.
    const initialStock = buildInitialStockFromCatalog();
    let changed = false;

    Object.entries(initialStock).forEach(([sku, row]) => {
      if (!current[sku]) {
        current[sku] = row;
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(STOCK_FILE, JSON.stringify(current, null, 2), 'utf8');
    }
  } catch {
    const initialStock = buildInitialStockFromCatalog();
    fs.writeFileSync(STOCK_FILE, JSON.stringify(initialStock, null, 2), 'utf8');
  }
}

function loadStock() {
  ensureStockFile();

  try {
    const raw = fs.readFileSync(STOCK_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveStock(stock) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(STOCK_FILE, JSON.stringify(stock || {}, null, 2), 'utf8');
}

function getVariantStock(variant) {
  const sku = String(variant?.sku || '').trim();

  if (!sku) return 0;

  const stock = loadStock();
  const row = stock[sku];

  if (!row) return 0;

  return Math.max(0, Number(row.stock || 0));
}

function deductStockForOrderOnce(orderInput) {
  const order = findOrderByDraftId(orderInput.orderDraftId) || orderInput;

  if (!order || !order.orderDraftId) {
    throw new Error('Pedido inválido para descontar stock.');
  }

  if (order.stockDeductedAt) {
    console.log('[stock] ya descontado para:', order.orderNumber || order.orderDraftId);
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) {
    throw new Error('El pedido no tiene artículos para descontar stock.');
  }

  const stock = loadStock();

  // 1) Validación completa antes de tocar nada.
  items.forEach((item) => {
    const sku = String(item.sku || '').trim();
    const qty = Math.max(1, Number(item.qty || 1));

    if (!sku) {
      throw new Error(`Artículo sin SKU en pedido ${order.orderNumber || order.orderDraftId}`);
    }

    const row = stock[sku];

    if (!row) {
      throw new Error(`SKU no encontrado en stock.json: ${sku}`);
    }

    const available = Math.max(0, Number(row.stock || 0));

    if (qty > available) {
      throw new Error(`Stock insuficiente al confirmar pago: ${sku}. Disponible: ${available}, pedido: ${qty}`);
    }
  });

  // 2) Descuento atómico a nivel de archivo local.
  items.forEach((item) => {
    const sku = String(item.sku || '').trim();
    const qty = Math.max(1, Number(item.qty || 1));

    stock[sku] = {
      ...stock[sku],
      stock: Math.max(0, Number(stock[sku].stock || 0) - qty),
      updatedAt: new Date().toISOString()
    };
  });

  saveStock(stock);

  upsertOrder({
    ...order,
    stockDeductedAt: new Date().toISOString()
  });

  console.log('[stock] descontado para:', order.orderNumber || order.orderDraftId);
}
function toCents(euros) {
  const n = Number(euros);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}
function loadShippingRates() {
  if (!fs.existsSync(SHIPPING_RATES_FILE)) {
    throw new Error('No existe data/shipping-rates.json.');
  }

  const raw = fs.readFileSync(SHIPPING_RATES_FILE, 'utf8');
  const data = JSON.parse(raw || '{}');

  if (!data || typeof data !== 'object') {
    throw new Error('shipping-rates.json no tiene un formato válido.');
  }

  return data;
}

function normalizeCountryCode(value = '') {
  const clean = String(value || '').trim().toLowerCase();

  if (['es', 'espana', 'españa', 'spain'].includes(clean)) return 'ES';
  if (['pt', 'portugal'].includes(clean)) return 'PT';
  if (['fr', 'france', 'francia'].includes(clean)) return 'FR';

  return clean.toUpperCase();
}

function normalizeProvince(value = '') {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findRegionRule(regions = {}, state = '') {
  const wanted = normalizeProvince(state);

  if (!wanted) return null;

  return Object.entries(regions).find(([name]) => {
    return normalizeProvince(name) === wanted;
  })?.[1] || null;
}

function calculateShipping({
  subtotal = 0,
  shippingDetails = null,
  tribeBenefits = null
} = {}) {
  const rates = loadShippingRates();

  const method = String(shippingDetails?.shippingMethod || 'home').trim();
  const countryCode = normalizeCountryCode(shippingDetails?.country || 'ES');
  const state = shippingDetails?.state || '';

  const country = rates.countries?.[countryCode];

  if (!country || country.enabled === false) {
    throw new Error(country?.message || 'Envío no disponible para este país.');
  }

  const methodConfig = country.methods?.[method];

  if (!methodConfig || methodConfig.enabled === false) {
    throw new Error('Método de envío no disponible.');
  }

  if (method === 'store') {
    return {
      shipping: 0,
      shippingRate: {
        country: countryCode,
        method,
        label: methodConfig.label || 'Recogida en tienda',
        carrier: methodConfig.carrier || 'Prophetia Studio',
        carrierLabel: methodConfig.carrier || 'Prophetia Studio',
        estimatedDelivery: methodConfig.estimatedDelivery || 'Te avisaremos cuando esté preparado',
        freeShippingFrom: 0,
        isFree: true
      }
    };
  }

  const carriers = methodConfig.carriers || {};
  const defaultCarrierId = methodConfig.defaultCarrier || Object.keys(carriers)[0] || '';
  const defaultCarrier = carriers[defaultCarrierId] || {};

  const regionRule = findRegionRule(methodConfig.regions || {}, state);

  if (regionRule?.enabled === false) {
    throw new Error(regionRule.message || 'Envío no disponible para esta zona.');
  }

  const carrierId = regionRule?.carrier || defaultCarrierId;
  const carrier = carriers[carrierId] || defaultCarrier;

  const basePrice = Number(
    regionRule?.price ??
    carrier.price ??
    methodConfig.price ??
    0
  );

  const freeFrom = Number(
    regionRule?.freeShippingFrom ??
    methodConfig.freeShippingFrom ??
    rates.freeShippingFrom ??
    40
  );

const cleanSubtotal = Number(subtotal || 0);

let tribeFreeShipping = false;
let tribeFreeShippingReason = '';

if (tribeBenefits?.freeShipping?.enabled) {
  const tribeMinSubtotal = Number(tribeBenefits.freeShipping.minSubtotal || 0);

  if (cleanSubtotal >= tribeMinSubtotal) {
    tribeFreeShipping = true;
   tribeFreeShippingReason =
  tribeMinSubtotal > 0
    ? `${tribeBenefits.rank} Priority Access — envío gratis desde ${tribeMinSubtotal} €`
    : `${tribeBenefits.rank} Circle Access — envío gratuito permanente`;
  }
}

const baseFreeShipping = cleanSubtotal >= freeFrom;
const isFree = tribeFreeShipping || baseFreeShipping;
const shipping = isFree ? 0 : Math.max(0, basePrice);

const freeShippingReason = tribeFreeShipping
  ? tribeFreeShippingReason
  : baseFreeShipping
    ? `Envío gratis desde ${freeFrom} €`
    : '';

return {
  shipping,
shippingRate: {
  country: countryCode,
  method,
  label: methodConfig.label || 'Entrega a domicilio',
  carrier: carrierId,
  carrierLabel: carrier.label || carrierId || 'Transportista',
  estimatedDelivery:
    regionRule?.estimatedDelivery ||
    carrier.estimatedDelivery ||
    methodConfig.estimatedDelivery ||
    '2–7 días laborables',
  freeShippingFrom: freeFrom,
  isFree,
  freeShippingReason,
  tribeFreeShipping,
  tribeFreeShippingReason
}
};
}

function findProduct(catalog, item) {
  const wantedId = String(item.id || '').trim();
  const wantedSlug = String(item.slug || '').trim();

  return catalog.find((product) => {
    return (
      String(product.id || '') === wantedId ||
      String(product.slug || '') === wantedSlug
    );
  });
}

function findVariant(product, item) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const wantedSku = String(item.sku || '').trim();
  const wantedColor = normalize(item.color);
  const wantedSize = normalize(item.size);

  if (!variants.length) {
    return {
      sku: `${product.id}_${item.color || 'default'}_${item.size || 'default'}`,
      color: item.color || product.color || '',
      size: item.size || '',
      stock: product.inStock === false ? 0 : 99
    };
  }

  return variants.find((variant) => {
    const sameSku = wantedSku && String(variant.sku || '').trim() === wantedSku;

    const sameOptions =
      normalize(variant.color) === wantedColor &&
      normalize(variant.size) === wantedSize;

    return sameSku || sameOptions;
  });
}

function findVersion(product, item) {
  const versions = Array.isArray(product.versions) ? product.versions : [];
  const wantedVersion = String(item.version || '').trim();

  if (!versions.length) return null;

  return versions.find((version) => {
    return String(version.id || '').trim() === wantedVersion;
  }) || null;
}

function buildSecureLineItems(cart, tribeBenefits = null) {
  const catalog = loadCatalog();

  return cart.map((item) => {
    const product = findProduct(catalog, item);

    if (!product) {
      throw new Error(`Producto no encontrado: ${item.id}`);
    }
    assertEarlyAccessAllowed(product, tribeBenefits);

    const variant = findVariant(product, item);

    if (!variant) {
      throw new Error(`Variante no encontrada para: ${product.id}`);
    }

    const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
    const stock = getVariantStock(variant);

    if (stock <= 0) {
      throw new Error(`Sin stock: ${product.title || product.id}`);
    }

    if (qty > stock) {
      throw new Error(`Stock insuficiente para: ${product.title || product.id}`);
    }

    const version = findVersion(product, item);

    const realPrice =
      Number(version?.price) ||
      Number(product.price);

    const unitAmount = toCents(realPrice);

    if (unitAmount <= 0) {
      throw new Error(`Precio inválido en servidor: ${product.id}`);
    }

    return {
      quantity: qty,
      price_data: {
        currency: 'eur',
        unit_amount: unitAmount,
        product_data: {
          name: product.title || 'Producto Prophetia',
          description: [
            version?.label ? `Versión: ${version.label}` : '',
            variant.color ? `Color: ${variant.color}` : '',
            variant.size ? `Talla: ${variant.size}` : ''
          ].filter(Boolean).join(' · '),
          images: [
            item.img,
            product.cover,
            product.media?.hombre?.cover,
            product.media?.mujer?.cover
          ].filter(Boolean).slice(0, 1)
        }
      }
    };
  });
}
function buildSecureCartSummary(cart, shippingDetails = null, options = {}) {
  const catalog = loadCatalog();
  const tribeBenefits = options.tribeBenefits || null;

  const items = cart.map((item) => {
const product = findProduct(catalog, item);

if (!product) {
  throw new Error(`Producto no encontrado: ${item.id}`);
}

assertEarlyAccessAllowed(product, tribeBenefits);

if (product.active === false) {
  throw new Error(`Producto no disponible: ${product.title || product.id}`);
}

    const variant = findVariant(product, item);

    if (!variant) {
      throw new Error(`Variante no encontrada para: ${product.id}`);
    }

    const qty = Math.max(1, Math.min(10, Number(item.qty) || 1));
    const stock = getVariantStock(variant);

    if (stock <= 0) {
      throw new Error(`Sin stock: ${product.title || product.id}`);
    }

    if (qty > stock) {
      throw new Error(`Stock insuficiente para: ${product.title || product.id}`);
    }

    const version = findVersion(product, item);

    const realPrice =
      Number(version?.price) ||
      Number(product.price);

    const unitAmount = toCents(realPrice);

    if (unitAmount <= 0) {
      throw new Error(`Precio inválido en servidor: ${product.id}`);
    }

    const unitPrice = unitAmount / 100;
    const lineTotal = unitPrice * qty;

    return {
      id: product.id,
      slug: product.slug || product.id,
      sku: variant.sku || item.sku || '',
      title: product.title || 'Producto Prophetia',
      version: version?.id || item.version || null,
      versionLabel: version?.label || '',
      color: variant.color || item.color || '',
      size: variant.size || item.size || '',
      qty,
      unitPrice,
      lineTotal,
      img:
        variant.img ||
        version?.cover ||
        item.img ||
        product.cover ||
        product.media?.hombre?.cover ||
        product.media?.mujer?.cover ||
        '',
      url: `/producto?id=${encodeURIComponent(product.id)}`
    };
  });

const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
const shippingResult = calculateShipping({
  subtotal,
  shippingDetails,
  tribeBenefits
});

return {
  currency: 'EUR',
  items,
  subtotal,
  shipping: shippingResult.shipping,
  shippingRate: shippingResult.shippingRate,
  tribeBenefits: tribeBenefits
    ? {
        rank: tribeBenefits.rank,
        rankId: tribeBenefits.rankId,
        freeShipping: tribeBenefits.freeShipping,
        earlyAccessHours: tribeBenefits.earlyAccessHours,
        priority: tribeBenefits.priority
      }
    : null,
  total: subtotal + shippingResult.shipping
};
}
app.post('/api/tribe/subscribe', async (req, res) => {
  try {
    const { name, email, birthDate, optin } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);
    const cleanBirthDate = String(birthDate || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        error: 'Indica tu nombre.'
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Introduce un email válido.'
      });
    }

    const age = calculateAgeFromBirthDate(cleanBirthDate);

    if (age < 18) {
      return res.status(400).json({
        error: 'Debes ser mayor de 18 años para unirte a Prophetia Tribe.'
      });
    }

    const member = upsertTribeMember({
      name: cleanName,
      email: cleanEmail,
      birthDate: cleanBirthDate,
      optin: !!optin
    });

 if (member.codeIssuedNow) {
  await sendTribeWelcomeEmail(member);
}

return res.json({
  ok: true,
  alreadyMember: !!member.alreadyMember,
  codeIssuedNow: !!member.codeIssuedNow,
  member: {
    name: member.name,
    email: member.email,
    discountCode: member.discountCode,
    discountPercent: member.discountPercent,
    discountStatus: member.discountStatus,
    points: Number(member.points || 0),
    pointsRequiredForNextDiscount: Number(member.pointsRequiredForNextDiscount || 100)
  },
  message: member.codeIssuedNow
    ? `Te has unido a Prophetia Tribe. Usa ${TRIBE_DISCOUNT_CODE} en tu próxima compra.`
    : 'Ya formas parte de Prophetia Tribe. No se ha generado un nuevo código.'
});
  } catch (err) {
    console.error('[tribe] subscribe error:', err);

    return res.status(500).json({
      error: 'No se ha podido completar la suscripción.'
    });
  }
});

app.post('/api/discount/validate', async (req, res) => {
  try {
    const { cart, shippingDetails, email, discountCode } = req.body || {};
        const firebaseUser = await getOptionalFirebaseUser(req);
    const cleanEmail = normalizeEmail(email);
    const canUseTribeDiscount =
      firebaseUser?.email &&
      cleanEmail &&
      firebaseUser.email === cleanEmail;

    if (!canUseTribeDiscount) {
      return res.status(403).json({
        error: 'Inicia sesión con el email de Prophetia Tribe para usar este código.'
      });
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        error: 'La cesta está vacía.'
      });
    }

    const tribeBenefits = getTribeBenefitsForEmail(firebaseUser.email);

const summary = buildSecureCartSummary(cart, shippingDetails, {
  tribeBenefits
});
    const discountResult = validateTribeDiscount({
  email: firebaseUser.email,
  code: discountCode,
  subtotal: summary.subtotal
});

    if (!discountResult.valid) {
      return res.status(400).json({
        error: discountResult.reason || 'Descuento no válido.',
        discount: discountResult
      });
    }

    const discountedSummary = applyDiscountToSummary(summary, discountResult);

    return res.json(discountedSummary);
  } catch (err) {
    console.error('[discount] validate error:', err);

    return res.status(400).json({
      error: err.message || 'No se ha podido validar el descuento.'
    });
  }
});
app.post('/api/cart-summary', async (req, res) => {
  try {
    const { cart, shippingDetails, email, discountCode } = req.body || {};
        const firebaseUser = await getOptionalFirebaseUser(req);
    const cleanEmail = normalizeEmail(email);
    const canUseTribeBenefits =
      firebaseUser?.email &&
      cleanEmail &&
      firebaseUser.email === cleanEmail;

    const tribeBenefits = canUseTribeBenefits
      ? getTribeBenefitsForEmail(firebaseUser.email)
      : null;

    if (!Array.isArray(cart) || cart.length === 0) {
   return res.json({
  currency: 'EUR',
  items: [],
  subtotal: 0,
  shipping: 0,
  shippingRate: null,
  total: 0
});
    }

let summary = buildSecureCartSummary(cart, shippingDetails, {
  tribeBenefits
});

if (discountCode) {
  if (!canUseTribeBenefits) {
    summary = {
      ...summary,
      discount: null,
      discountError: 'Inicia sesión con el email de Prophetia Tribe para usar este código.'
    };

    return res.json(summary);
  }

  const discountResult = validateTribeDiscount({
    email: firebaseUser.email,
    code: discountCode,
    subtotal: summary.subtotal
  });
  if (discountResult.valid) {
    summary = applyDiscountToSummary(summary, discountResult);
  } else {
    summary = {
      ...summary,
      discount: null,
      discountError: discountResult.reason
    };
  }
}

return res.json(summary);
  } catch (err) {
    console.error('[cart-summary] error:', err);

    return res.status(400).json({
      error: err.message || 'No se ha podido validar la cesta.'
    });
  }
});
app.get('/api/order-by-session', requireFirebaseUser, async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();

    if (!sessionId) {
      return res.status(400).json({ error: 'Falta session_id.' });
    }

    let order = findOrderBySessionId(sessionId);

    if (!order) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const orderDraftId = session.metadata?.orderDraftId || null;

      if (orderDraftId) {
        const currentOrder = findOrderByDraftId(orderDraftId);

        if (currentOrder) {
          order = {
            ...currentOrder,
            stripeSessionId: session.id,
            paymentStatus: session.payment_status,
            status: session.payment_status === 'paid' ? 'paid' : currentOrder.status,
            amountTotal: Number(session.amount_total || 0) / 100,
            currency: String(session.currency || currentOrder.currency || 'eur').toUpperCase()
          };

upsertOrder(order);

if (order.status === 'paid' || order.paymentStatus === 'paid') {
  order = await finalizePaidOrderOnce(order);
}
        }
      }
    }

    if (!order) {
      return res.status(404).json({ error: 'No se ha encontrado el pedido.' });
    }
    const cleanOrderEmail = normalizeEmail(order.customerEmail);
const cleanUserEmail = normalizeEmail(req.firebaseUser.email);

if (!cleanOrderEmail || cleanOrderEmail !== cleanUserEmail) {
  return res.status(403).json({
    error: 'No tienes permiso para consultar este pedido.'
  });
}


    return res.json({
  order: {
    orderDraftId: order.orderDraftId,
    orderNumber: order.orderNumber || order.orderDraftId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerEmail: order.customerEmail,
        currency: order.currency,
        items: order.items || [],
        subtotal: order.subtotal,
       shipping: order.shipping,
shippingRate: order.shippingRate || null,
estimatedDelivery: order.estimatedDelivery || order.shippingRate?.estimatedDelivery || '2–7 días laborables',
total: order.total,
amountTotal: order.amountTotal,
        paidAt: order.paidAt || null,
createdAt: order.createdAt || null,
tribePointsEarned: order.tribePointsEarned || 0,
tribeXpEvent: order.tribeXpEvent || null
      }
    });
  } catch (err) {
    console.error('[order-by-session] error:', err);
    return res.status(500).json({
      error: 'No se ha podido recuperar el pedido.'
    });
  }
});
/* =========================================================
   PROPHETIA · TRIBE PROFILE
   Fuente local: data/tribe-members.json
   Seguridad: Firebase ID token verificado en servidor
   ========================================================= */
app.get('/api/tribe/me', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.firebaseUser.email);

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene un email válido asociado.'
      });
    }

let member = findTribeMemberByEmail(cleanEmail);
    if (!member || member.status !== 'active') {
const rankInfo = getTribeRankInfo(0);
const publicRankBenefits = getPublicTribeRankBenefits(rankInfo.rankId);

return res.json({
        member: null,
        points: 0,
        lifetimePoints: 0,
        rank: rankInfo.rank,
        rankId: rankInfo.rankId,
        rankMin: rankInfo.rankMin,
        nextRank: rankInfo.nextRank,
        nextRankId: rankInfo.nextRankId,
        nextRankAt: rankInfo.nextRankAt,
        pointsToNextRank: rankInfo.pointsToNextRank,
        progressPercent: rankInfo.progressPercent,
        discountStatus: 'not_member',
        usedCount: 0,
        discountCode: null,
        discountPercent: 0,
        accessLabel: publicRankBenefits.accessLabel,
objective: publicRankBenefits.objective,
earlyAccessHours: publicRankBenefits.earlyAccessHours,
freeShipping: publicRankBenefits.freeShipping,
priority: publicRankBenefits.priority,
benefits: publicRankBenefits.benefits,
rankMessage: publicRankBenefits.message,
rewardOnUnlock: publicRankBenefits.rewardOnUnlock,
rewards: [],
availableRewards: [],
usedRewards: [],
lastUnlockedRewards: [],
missions: TRIBE_MISSIONS.map((mission) => ({
  id: mission.id,
  title: mission.title,
  description: mission.description,
  points: Number(mission.points || 0),
  target: Number(mission.target || 1),
  progress: 0,
  status: 'locked',
  completed: false,
  completedAt: null,
  publicLabel: mission.publicLabel || '',
  type: mission.type,
  autoClaim: !!mission.autoClaim
})),
message: 'Este usuario todavía no forma parte de Prophetia Tribe.'
      });
    }
member = syncAutomaticTribeMissionsForMember(member);
const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
const currentPoints = Number(member.points || 0);
const rankInfo = getTribeRankInfo(lifetimePoints);
const prestigeInfo = getTribePrestigeInfo(lifetimePoints);
const publicRankBenefits = getPublicTribeRankBenefits(rankInfo.rankId);

const publicRewards = getPublicTribeRewards(member);
const availableRewards = publicRewards.filter((reward) => reward.status === 'available');
const usedRewards = publicRewards.filter((reward) => reward.status === 'used');
const lastUnlockedRewards = getPublicLastUnlockedRewards(member);

return res.json({
      member: {
        name: member.name || '',
        email: member.email || cleanEmail,
        status: member.status || 'active',
        createdAt: member.createdAt || null,
        updatedAt: member.updatedAt || null
      },

      points: currentPoints,
      lifetimePoints,

     rank: rankInfo.rank,
rankId: rankInfo.rankId,
      rankMin: rankInfo.rankMin,

      nextRank: rankInfo.nextRank,
      nextRankId: rankInfo.nextRankId,
      nextRankAt: rankInfo.nextRankAt,
      pointsToNextRank: Number(rankInfo.pointsToNextRank),
      progressPercent: Number(rankInfo.progressPercent),

      discountCode: member.discountCode || TRIBE_DISCOUNT_CODE,
      discountPercent: Number(member.discountPercent || TRIBE_DISCOUNT_PERCENT),
      discountStatus: member.discountStatus || 'available',
      usedCount: Number(member.usedCount || 0),
      pointsRequiredForNextDiscount: Number(
        member.pointsRequiredForNextDiscount || TRIBE_POINTS_REDEEM_COST
      ),

lastXpEvent: member.lastXpEvent || null,
lastMissionEvent: member.lastMissionEvent || null,
missions: getPublicTribeMissions(member),
rewards: publicRewards,
availableRewards,
usedRewards,
lastUnlockedRewards,
prestige: prestigeInfo,
isPrestigeActive: prestigeInfo.isPrestigeActive,
prestigeLevel: prestigeInfo.prestigeLevel,
prestigeId: prestigeInfo.prestigeId,
prestigeLabel: prestigeInfo.prestigeLabel,
prestigeEmblem: prestigeInfo.prestigeEmblem,
nextPrestigeAt: prestigeInfo.nextPrestigeAt,
nextPrestigeLabel: prestigeInfo.nextPrestigeLabel,
pointsToNextPrestige: prestigeInfo.pointsToNextPrestige,
prestigeProgressPercent: prestigeInfo.prestigeProgressPercent,
prestigeBenefits: prestigeInfo.prestigeBenefits,
accessLabel: publicRankBenefits.accessLabel,
objective: publicRankBenefits.objective,
earlyAccessHours: publicRankBenefits.earlyAccessHours,
freeShipping: publicRankBenefits.freeShipping,
priority: publicRankBenefits.priority,
benefits: publicRankBenefits.benefits,
rankMessage: publicRankBenefits.message,
rewardOnUnlock: publicRankBenefits.rewardOnUnlock
    });
  } catch (err) {
    console.error('[tribe-me] error:', err);

    return res.status(500).json({
      error: 'No se ha podido cargar tu perfil Prophetia Tribe.'
    });
  }
});
async function userHasAtLeastOneAddress(uid = '') {
  const cleanUid = String(uid || '').trim();

  if (!cleanUid || !admin.apps.length) {
    return false;
  }

  try {
    const snap = await admin
      .firestore()
      .collection('users')
      .doc(cleanUid)
      .collection('addresses')
      .limit(1)
      .get();

    return !snap.empty;
  } catch (err) {
    console.error('[tribe-mission] error verificando direcciones:', err);
    return false;
  }
}
/* =========================================================
   PROPHETIA · TRIBE MISSION CHECK
   Completa misiones automáticas desde acciones verificadas
   ========================================================= */

app.post('/api/tribe/mission/check', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.firebaseUser.email);
    const missionId = String(req.body?.missionId || '').trim();
    const progress = req.body?.progress ?? null;

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene un email válido asociado.'
      });
    }

    const mission = getMissionConfig(missionId);

    if (!mission) {
      return res.status(400).json({
        error: 'Misión no válida.'
      });
    }

    /*
      Seguridad:
      Solo permitimos completar desde endpoint misiones concretas.
      Las de compra se validan por webhook/pedidos, no por frontend.
    */
    const allowedManualChecks = new Set([
      'first-address'
    ]);

    if (!allowedManualChecks.has(mission.id)) {
      return res.status(403).json({
        error: 'Esta misión no puede completarse manualmente.'
      });
    }

let verifiedProgress = progress;
let verifiedReason = 'client-verified-action';

if (mission.id === 'first-address') {
  const hasAddress = await userHasAtLeastOneAddress(req.firebaseUser.uid);

  if (!hasAddress) {
    return res.status(403).json({
      error: 'Añade una dirección antes de completar esta misión.'
    });
  }

  verifiedProgress = 1;
  verifiedReason = 'firestore-address-verified';
}

const result = completeTribeMissionForEmail({
  email: cleanEmail,
  missionId: mission.id,
  progress: verifiedProgress,
  reason: verifiedReason
});

    if (!result.ok) {
      return res.status(400).json({
        error: result.error || 'No se ha podido completar la misión.'
      });
    }

    const member = syncAutomaticTribeMissionsForMember(result.member);
    const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
    const rankInfo = getTribeRankInfo(lifetimePoints);
    const prestigeInfo = getTribePrestigeInfo(lifetimePoints);
    const publicRankBenefits = getPublicTribeRankBenefits(rankInfo.rankId);

    return res.json({
      ok: true,
      completedNow: !!result.completedNow,
      mission: result.mission,
      missionEvent: result.missionEvent || null,
      points: Number(member.points || 0),
      lifetimePoints,
      rank: rankInfo.rank,
      rankId: rankInfo.rankId,
      nextRank: rankInfo.nextRank,
      nextRankAt: rankInfo.nextRankAt,
      pointsToNextRank: rankInfo.pointsToNextRank,
      progressPercent: rankInfo.progressPercent,
      prestige: prestigeInfo,
      accessLabel: publicRankBenefits.accessLabel,
      benefits: publicRankBenefits.benefits,
      missions: getPublicTribeMissions(member)
    });
  } catch (err) {
    console.error('[tribe-mission-check] error:', err);

    return res.status(500).json({
      error: 'No se ha podido comprobar la misión Tribe.'
    });
  }
});

/* =========================================================
   PROPHETIA · PRIVATE CALENDAR DROPS
   Devuelve solo fechas permitidas por rango Tribe
   ========================================================= */

app.get('/api/drops/private', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.firebaseUser.email);

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene un email válido asociado.'
      });
    }

    const member = findTribeMemberByEmail(cleanEmail);

    if (!member || member.status !== 'active') {
      return res.json({
        drops: [],
        access: {
          rankId: 'tribe-member',
          rank: 'Tribe Member',
          message: 'Únete a Prophetia Tribe para desbloquear fechas privadas.'
        }
      });
    }

    const userRankId = getCalendarAccessRankId(member);
    const lifetimePoints = Number(member.lifetimePoints || member.points || 0);
    const rankInfo = getTribeRankInfo(lifetimePoints);
    const prestigeInfo = getTribePrestigeInfo(lifetimePoints);

    const displayRank = prestigeInfo.isPrestigeActive
      ? prestigeInfo.prestigeLabel
      : rankInfo.rank;

    const privateDrops = loadPrivateDrops();

    const allowedDrops = privateDrops
      .filter((drop) => {
        const visibility = String(drop.visibility || '').toLowerCase();

        if (visibility !== 'tribe' && visibility !== 'private') {
          return false;
        }

        const requiredRankId = drop.requiredRankId || 'tribe-member';

        return hasRequiredCalendarRank(userRankId, requiredRankId);
      })
      .map((drop) => {
   return {
  id: String(drop.id || ''),
  dropId: String(drop.dropId || ''),
  title: String(drop.title || 'Fecha privada Prophetia'),
  type: String(drop.type || 'private'),
  date: String(drop.date || ''),
  time: String(drop.time || ''),
  unlockAt: String(drop.unlockAt || ''),
  status: String(drop.status || 'private'),
  visibility: 'tribe',
  requiredRankId: String(drop.requiredRankId || 'tribe-member'),
  description: String(drop.description || ''),
  href: String(drop.href || '/prophet-private'),
  ctaLocked: String(drop.ctaLocked || ''),
  ctaUnlocked: String(drop.ctaUnlocked || 'Ver drop privado')
};
      })
      .filter((drop) => drop.id && drop.date);
    return res.json({
      drops: allowedDrops,
      access: {
        rankId: userRankId,
        rank: displayRank,
        totalPrivateDrops: privateDrops.length,
        unlockedPrivateDrops: allowedDrops.length
      }
    });
  } catch (err) {
    console.error('[private-drops] error:', err);

    return res.status(500).json({
      error: 'No se han podido cargar las fechas privadas.'
    });
  }
});
/* =========================================================
   PROPHETIA · PROPHET PRIVATE DROPS
   Sala privada /prophet-private
   Seguridad: Firebase + Tribe + rango + unlockAt
   ========================================================= */

app.get('/api/private-drops', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.firebaseUser.email);

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene un email válido asociado.'
      });
    }

    const member = findTribeMemberByEmail(cleanEmail);
    const access = getPrivateDropAccessForMember(member);

    if (!access) {
      return res.json({
        drops: [],
        access: {
          allowed: false,
          rankId: 'tribe-member',
          rank: 'Tribe Member',
          message: 'Únete a Prophetia Tribe para consultar la sala privada Prophet.'
        }
      });
    }

    const privateDropPages = loadPrivateDropPages();

    const visibleDrops = privateDropPages
      .filter((drop) => {
        const visibility = String(drop.visibility || '').toLowerCase();

        if (visibility !== 'tribe' && visibility !== 'private') {
          return false;
        }

        const requiredRankId = String(drop.requiredRankId || 'prophet');

        return hasRequiredCalendarRank(access.rankId, requiredRankId);
      })
      .map((drop) => sanitizePrivateDropSummary(drop, access))
      .filter((drop) => drop.id);

    const availableDrops = visibleDrops.filter((drop) => drop.unlocked);
    const upcomingDrops = visibleDrops.filter((drop) => !drop.unlocked);

    return res.json({
      drops: visibleDrops,
      availableDrops,
      upcomingDrops,
      access: {
        allowed: true,
        rankId: access.rankId,
        rank: access.rank,
        lifetimePoints: access.lifetimePoints,
        availableCount: availableDrops.length,
        upcomingCount: upcomingDrops.length
      }
    });
  } catch (err) {
    console.error('[private-drops-list] error:', err);

    return res.status(500).json({
      error: 'No se han podido cargar los drops privados.'
    });
  }
});

app.get('/api/private-drops/:id', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.firebaseUser.email);
    const dropId = String(req.params.id || '').trim();

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(403).json({
        error: 'Tu cuenta no tiene un email válido asociado.'
      });
    }

    if (!dropId) {
      return res.status(400).json({
        error: 'Falta el identificador del drop privado.'
      });
    }

    const member = findTribeMemberByEmail(cleanEmail);
    const access = getPrivateDropAccessForMember(member);

    if (!access) {
      return res.status(403).json({
        error: 'Necesitas formar parte de Prophetia Tribe para acceder a esta sala.'
      });
    }

    const privateDropPages = loadPrivateDropPages();

    const drop = privateDropPages.find((item) => {
      return String(item.id || '') === dropId;
    });

    if (!drop) {
      return res.status(404).json({
        error: 'Drop privado no encontrado.'
      });
    }

    const requiredRankId = String(drop.requiredRankId || 'prophet');

    if (!hasRequiredCalendarRank(access.rankId, requiredRankId)) {
      return res.status(403).json({
        error: `Necesitas rango ${requiredRankId} o superior para acceder a este drop privado.`,
        requiredRankId,
        userRankId: access.rankId
      });
    }

    if (!isPrivateDropUnlocked(drop)) {
      return res.status(423).json({
        error: 'Este drop privado todavía no está disponible.',
        locked: true,
        unlockAt: String(drop.unlockAt || ''),
        requiredRankId,
        userRankId: access.rankId
      });
    }

    return res.json({
      drop: sanitizePrivateDropDetail(drop),
      access: {
        allowed: true,
        rankId: access.rankId,
        rank: access.rank,
        lifetimePoints: access.lifetimePoints
      }
    });
  } catch (err) {
    console.error('[private-drop-detail] error:', err);

    return res.status(500).json({
      error: 'No se ha podido cargar el drop privado.'
    });
  }
});

/* =========================================================
   PROPHETIA · MIS PEDIDOS
   Fuente local: data/orders.json
   Seguridad: Firebase ID token verificado en servidor
   ========================================================= */
app.post('/api/my-orders', requireFirebaseUser, async (req, res) => {
  try {
    const cleanEmail = String(req.firebaseUser.email || '').trim().toLowerCase();

    const orders = loadOrders()
      .filter((order) => {
        return String(order.customerEmail || '').trim().toLowerCase() === cleanEmail;
      })
      .filter((order) => {
        return order.status === 'paid' || order.paymentStatus === 'paid';
      })
      .sort((a, b) => {
        return new Date(b.paidAt || b.updatedAt || b.createdAt || 0) -
               new Date(a.paidAt || a.updatedAt || a.createdAt || 0);
      })
      .map((order) => ({
        id: order.orderDraftId,
        orderNumber: order.orderNumber || order.orderDraftId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        statusLabel: order.status === 'paid' ? 'Pedido confirmado' : 'Pedido pendiente',
        fulfillmentStatus: order.fulfillmentStatus || 'preparing',
        customerEmail: order.customerEmail,
        currency: order.currency || 'EUR',
        items: order.items || [],
        subtotal: order.subtotal || 0,
        shipping: order.shipping || 0,
        total: order.total || order.amountTotal || 0,
        amountTotal: order.amountTotal || order.total || 0,
        estimatedDelivery: order.estimatedDelivery || order.shippingRate?.estimatedDelivery || '2–7 días laborables',
shippingRate: order.shippingRate || null,
        trackingUrl: order.trackingUrl || '',
        createdAt: order.createdAt || order.paidAt || order.updatedAt || null,
        paidAt: order.paidAt || null
      }));

    return res.json({
      orders
    });
  } catch (err) {
    console.error('[my-orders] error:', err);

    return res.status(500).json({
      error: 'No se han podido cargar los pedidos.'
    });
  }
});
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { cart, email, shippingDetails, gift, invoice, discountCode } = req.body || {};

    const firebaseUser = await getOptionalFirebaseUser(req);
    const cleanEmail = normalizeEmail(email);

    if (!firebaseUser?.email) {
      return res.status(401).json({
        error: 'Debes iniciar sesión antes de continuar al pago.'
      });
    }

    if (!cleanEmail || firebaseUser.email !== cleanEmail) {
      return res.status(403).json({
        error: 'El email del checkout no coincide con tu sesión Prophetia.'
      });
    }

    const tribeBenefits = getTribeBenefitsForEmail(firebaseUser.email);

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'La cesta está vacía.' });
    }

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    if (!shippingDetails || !shippingDetails.shippingMethod) {
      return res.status(400).json({ error: 'Faltan datos de envío.' });
    }

   let secureSummary = buildSecureCartSummary(cart, shippingDetails, {
  tribeBenefits
});

if (discountCode && !tribeBenefits) {
  return res.status(403).json({
    error: 'Este email no tiene beneficios activos de Prophetia Tribe.'
  });
}

const tribeDiscountResult = discountCode
  ? validateTribeDiscount({
      email: firebaseUser.email,
      code: discountCode,
      subtotal: secureSummary.subtotal
    })
  : null;

if (discountCode && !tribeDiscountResult?.valid) {
  return res.status(400).json({
    error: tribeDiscountResult?.reason || 'Descuento no válido.'
  });
}

if (tribeDiscountResult?.valid) {
  secureSummary = applyDiscountToSummary(secureSummary, tribeDiscountResult);
}

const line_items = secureSummary.items.map((item) => {
  return {
    quantity: item.qty,
    price_data: {
      currency: 'eur',
      unit_amount: Math.round(Number(item.unitPrice || 0) * 100),
      product_data: {
        name: item.title || 'Producto Prophetia',
        description: [
          item.versionLabel ? `Versión: ${item.versionLabel}` : '',
          item.color ? `Color: ${item.color}` : '',
          item.size ? `Talla: ${item.size}` : ''
        ].filter(Boolean).join(' · '),
        images: [item.img].filter(Boolean).slice(0, 1)
      }
    }
  };
});
if (Number(secureSummary.shipping || 0) > 0) {
  line_items.push({
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: Math.round(Number(secureSummary.shipping || 0) * 100),
      product_data: {
        name: `Envío — ${secureSummary.shippingRate?.carrierLabel || 'Transportista'}`,
        description: secureSummary.shippingRate?.estimatedDelivery || 'Envío estándar'
      }
    }
  });
}
const orderDraftId = `pp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

upsertOrder({
  orderDraftId,
  orderNumber: generateOrderNumber(),
  status: 'pending_payment',
  paymentStatus: 'unpaid',
  customerEmail: cleanEmail,
  shippingDetails,
  shippingRate: secureSummary.shippingRate || null,
  estimatedDelivery: secureSummary.shippingRate?.estimatedDelivery || '2–7 días laborables',
  gift: gift || null,
  invoice: invoice || null,
  currency: secureSummary.currency || 'EUR',
  items: secureSummary.items,
  subtotal: secureSummary.subtotal,
shipping: secureSummary.shipping,
discount: secureSummary.discount || null,
tribeBenefits: secureSummary.tribeBenefits || null,
total: secureSummary.total
});
let stripeDiscounts = undefined;

if (secureSummary.discount?.code && Number(secureSummary.discount.amount || 0) > 0) {
  const coupon = await stripe.coupons.create({
    amount_off: Math.round(Number(secureSummary.discount.amount || 0) * 100),
    currency: 'eur',
    duration: 'once',
    name: `Prophetia Tribe · ${secureSummary.discount.code}`
  });

  stripeDiscounts = [{ coupon: coupon.id }];
}
const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: cleanEmail,
      line_items,
discounts: stripeDiscounts,
success_url: `${SITE_URL}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout#nav-js-payment-checkoutnc`,
     metadata: {
  orderDraftId,
  shippingMethod: shippingDetails.shippingMethod,
  carrier: secureSummary.shippingRate?.carrier || '',
  carrierLabel: secureSummary.shippingRate?.carrierLabel || '',
  estimatedDelivery: secureSummary.shippingRate?.estimatedDelivery || '',
discountCode: secureSummary.discount?.code || '',
discountType: secureSummary.discount?.type || '',
discountRewardId: secureSummary.discount?.rewardId || '',
discountRank: secureSummary.discount?.rank || '',
discountRankId: secureSummary.discount?.rankId || '',
discountPercent: secureSummary.discount?.percent ? String(secureSummary.discount.percent) : '',
discountAmount: secureSummary.discount?.amount ? String(secureSummary.discount.amount) : '',
tribeRank: secureSummary.tribeBenefits?.rank || '',
tribeRankId: secureSummary.tribeBenefits?.rankId || '',
tribeFreeShipping: secureSummary.shippingRate?.tribeFreeShipping ? 'yes' : 'no',
gift: gift?.isGift ? 'yes' : 'no',
invoiceWanted: invoice?.invoiceWanted ? 'yes' : 'no'
}
    });

   return res.json({
  url: session.url,
  orderDraftId,
  orderNumber: findOrderByDraftId(orderDraftId)?.orderNumber || orderDraftId
});
  } catch (err) {
    console.error('[stripe] create-checkout-session error:', err);

    return res.status(400).json({
      error: err.message || 'No se ha podido crear la sesión de pago.'
    });
  }
});
/* =========================================================
   PROPHETIA · CLEAN URLS
   /home -> public/home.html

   PRODUCCIÓN:
   - Mantener URLs limpias sin .html.
   - /home.html e /index.html redirigen a /home.
   - No tocar salvo cambio de arquitectura/routing.
   ========================================================= */

app.get('/', (req, res) => {
  res.redirect(301, '/home');
});

app.get(['/home.html', '/index.html'], (req, res) => {
  res.redirect(301, '/home');
});
app.get('/:page', (req, res, next) => {
  const page = String(req.params.page || '').trim();

  if (!/^[a-z0-9-]+$/i.test(page)) {
    return next();
  }

  const filePath = path.join(PUBLIC_DIR, `${page}.html`);

  if (!fs.existsSync(filePath)) {
    return next();
  }

  return res.sendFile(filePath);
});


/* =========================================================
   PROPHETIA · CLEAN URLS ANIDADAS LOCAL
   /assets/collects/ms -> public/assets/collects/ms.html
   ========================================================= */

app.get(/^\/(.+)$/, (req, res, next) => {
  const cleanPath = String(req.params[0] || '').trim();

  if (
    cleanPath.startsWith('api/') ||
    cleanPath.includes('..') ||
    /\.[a-z0-9]+$/i.test(cleanPath)
  ) {
    return next();
  }

  const filePath = path.join(PUBLIC_DIR, `${cleanPath}.html`);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return next();
  }

  if (!fs.existsSync(filePath)) {
    return next();
  }

  return res.sendFile(filePath);
});
/* =========================================================
   PROPHETIA · 404
   Página elegante para rutas inexistentes.
   Debe ir después de rutas API, estáticos y clean URLs.
   ========================================================= */

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});
app.listen(PORT, () => {
  ensureStockFile();

  /*
    PRODUCCIÓN:
    - Estos logs no imprimen claves.
    - Sirven para confirmar URL activa y rutas de datos.
    - Nunca imprimir STRIPE_SECRET_KEY, RESEND_API_KEY ni Firebase credentials.
  */
  console.log(`PROPHETIA server running: ${SITE_URL}`);
  console.log(`[orders] file: ${ORDERS_FILE}`);
  console.log(`[stock] file: ${STOCK_FILE}`);
});