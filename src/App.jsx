import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  writeBatch,
  where,
  query,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import {
  Move,
  Plus,
  ShieldAlert,
  Layers,
  Image as ImageIcon,
  Upload,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Camera,
  Trash2,
  Settings,
  Scaling,
  Briefcase,
  Package,
  PlusSquare,
  Bug,
  Eye,
  Rocket,
  Zap,
  Bot,
  Sprout,
  Flower,
  DoorOpen,
  Flag,
  MapPin,
  User,
  Users,
  Anchor,
  Tent,
  Skull,
  Radio,
  Key,
  CircleDot,
  Crown,
  Heart,
  EyeOff,
  Download,
  Menu,
  MoreVertical,
  Home,
  Share2,
  ZoomIn,
  ZoomOut,
  Copy,
  Edit3,
} from 'lucide-react';

/* ========================================
  RESPONSIVE HOOKS
  ========================================
*/
const useWindowSize = () => {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

const useIsMobile = () => {
  const { width } = useWindowSize();
  return width < 768;
};

const useIsTablet = () => {
  const { width } = useWindowSize();
  return width >= 768 && width < 1280;
};

/* ========================================
  FIREBASE CONFIGURATION
  ========================================
*/
const globalConfig =
  typeof globalThis !== 'undefined' && typeof globalThis.__firebase_config !== 'undefined'
    ? globalThis.__firebase_config
    : '{}';

let parsedConfig = {};
try {
  parsedConfig = typeof globalConfig === 'string' ? JSON.parse(globalConfig) : globalConfig || {};
} catch (err) {
  console.warn('Failed to parse __firebase_config, falling back to empty config.', err);
  parsedConfig = {};
}

const envFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const hasEnvConfig = Object.values(envFirebaseConfig).some(Boolean);
const firebaseConfig = hasEnvConfig ? envFirebaseConfig : parsedConfig;

const firebaseEnabled = Boolean(firebaseConfig && firebaseConfig.apiKey);
const firebaseDisabledFlag =
  typeof globalThis !== 'undefined' && typeof globalThis.__disable_firebase !== 'undefined'
    ? Boolean(globalThis.__disable_firebase)
    : false;

let app = null;
let auth = null;
let db = null;
let firebaseReady = false;
if (firebaseEnabled && !firebaseDisabledFlag) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseReady = Boolean(app && auth && db);
  } catch (err) {
    console.warn('Firebase init failed, running in local mode instead.', err);
    firebaseReady = false;
  }
}

const useFirebase = firebaseReady;

const appId =
  typeof globalThis !== 'undefined' && typeof globalThis.__app_id !== 'undefined'
    ? globalThis.__app_id
    : import.meta.env.VITE_APP_ID || 'arcraidersmap';

const SAVED_ROOMS_KEY = 'tactical_saved_rooms';
const MAX_OWNER_ROOMS = 5;

/* ========================================
  GAME DATA DEFINITIONS
  ========================================
*/

const mapAsset = (path) => `${import.meta.env.BASE_URL}maps/${path}`;

export const MAP_CONFIG = {
  dam: {
    id: 'dam',
    name: 'ダム戦場',
    width: 2000,
    height: 2000,
    defaultUrl: mapAsset('dam.jpg'),
    bgColor: '#1a1d21',
    gridColor: '#2a2e33',
  },
  spaceport: {
    id: 'spaceport',
    name: '宇宙港',
    width: 2400,
    height: 1600,
    defaultUrl: mapAsset('spaceport.jpg'),
    bgColor: '#161b22',
    gridColor: '#1f2937',
  },
  buried: {
    id: 'buried',
    name: '埋もれた町',
    width: 2000,
    height: 2000,
    defaultUrl: mapAsset('buried.jpg'),
    bgColor: '#1f1a16',
    gridColor: '#332b25',
  },
  bluegate: {
    id: 'bluegate',
    name: 'ブルーゲート',
    width: 2400,
    height: 1600,
    defaultUrl: mapAsset('bluegate.jpg'),
    bgColor: '#1e293b',
    gridColor: '#334155',
  },
  stella: {
    id: 'stella',
    name: 'ステラ・モンティス',
    width: 2400,
    height: 1600,
    bgColor: '#0f172a',
    gridColor: '#1e293b',
    layers: [
      { id: 'upper', name: '地上 (施設)', defaultUrl: mapAsset('stella_upper.jpg') },
      { id: 'lower', name: '地下 (メトロ)', defaultUrl: mapAsset('stella_lower.jpg') },
    ],
  },
};

/* ========================================
  VALIDATION / LIMITS
  ========================================
*/

const PIN_LIMITS = {
  maxPinsPerRoom: 500,
  maxProfilesPerRoom: 20,
  maxNoteLength: 500,
  maxImageBytes: 800 * 1024, // ~800KB (base64 is larger than the raw file)
  pinTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 days
  roomTtlMs: 1000 * 60 * 60 * 24 * 90, // 90 days
  rate: {
    pinAddMs: 150, // more permissive to avoid誤検知
    noteUpdateMs: 400,
    imageUpdateMs: 1500,
  },
};

const clampToRange = (value, min, max) => Math.min(Math.max(value, min), max);

const estimateDataUrlBytes = (dataUrl = '') => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return 0;
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
};

const isLayerValidForMap = (mapDef, layerId) => {
  if (!mapDef?.layers) return !layerId;
  if (!layerId) return true;
  return mapDef.layers.some((layer) => layer.id === layerId);
};

const ttlTimestamp = (ms) => Timestamp.fromMillis(Date.now() + ms);

const MARKER_CATEGORIES = {
  containers: { label: 'コンテナ', color: '#f59e0b' },
  arc: { label: 'アーク', color: '#ef4444' },
  nature: { label: '自然', color: '#10b981' },
  events: { label: 'イベント', color: '#a855f7' },
  others: { label: 'その他', color: '#3b82f6' },
};

const MARKERS = {
  // Containers (11)
  weapon_case: { id: 'weapon_case', cat: 'containers', label: '武器ケース', icon: Briefcase },
  med_bag: { id: 'med_bag', cat: 'containers', label: '回復バッグ', icon: PlusSquare },
  grenade_tube: { id: 'grenade_tube', cat: 'containers', label: 'グレネードチューブ', icon: CircleDot },
  ammo_crate: { id: 'ammo_crate', cat: 'containers', label: '弾薬箱', icon: Package },
  backpack: { id: 'backpack', cat: 'containers', label: 'バックパック', icon: Briefcase },
  security_lockbox: { id: 'security_lockbox', cat: 'containers', label: 'セキュリティロックボックス', icon: Key },
  baron_husk: { id: 'baron_husk', cat: 'containers', label: 'バロン・ハスク', icon: Skull },
  rocketeer_husk: { id: 'rocketeer_husk', cat: 'containers', label: 'ロケッティアハスク', icon: Rocket },
  wasp_husk: { id: 'wasp_husk', cat: 'containers', label: 'スズメバチの殻', icon: CircleDot },
  arc_courier: { id: 'arc_courier', cat: 'containers', label: 'ARCクーリエ', icon: Package },
  crashed_probe: { id: 'crashed_probe', cat: 'containers', label: '墜落した探査機', icon: Radio },

  // Arc (11 + Matriarch)
  tick: { id: 'tick', cat: 'arc', label: 'チック', icon: Bug },
  pop: { id: 'pop', cat: 'arc', label: 'ポップ', icon: CircleDot },
  fireball: { id: 'fireball', cat: 'arc', label: 'ファイヤボール', icon: Zap },
  wasp: { id: 'wasp', cat: 'arc', label: 'ワスプ', icon: Bot },
  hornet: { id: 'hornet', cat: 'arc', label: 'ホーネット', icon: Bot },
  surveyor: { id: 'surveyor', cat: 'arc', label: 'arc偵察機', icon: Eye },
  sentinel: { id: 'sentinel', cat: 'arc', label: 'センチネル', icon: ShieldAlert },
  shredder: { id: 'shredder', cat: 'arc', label: 'シュレッター', icon: Bot },
  rocketeer_arc: { id: 'rocketeer_arc', cat: 'arc', label: 'ロケッティア', icon: Bot },
  leaper: { id: 'leaper', cat: 'arc', label: 'Leaper', icon: Bot },
  bombardier: { id: 'bombardier', cat: 'arc', label: 'ボンバルディア', icon: Bot },
  bastion: { id: 'bastion', cat: 'arc', label: 'バスティオン', icon: ShieldAlert },
  queen: { id: 'queen', cat: 'arc', label: 'クイーン', icon: Crown },
  matriarch: { id: 'matriarch', cat: 'arc', label: 'マトリアーク', icon: Crown },

  // Nature (6)
  mushrooms: { id: 'mushrooms', cat: 'nature', label: 'キノコ', icon: Sprout },
  great_mullein: { id: 'great_mullein', cat: 'nature', label: 'ビロードモウズイカ', icon: Flower },
  agave: { id: 'agave', cat: 'nature', label: 'アガベ', icon: Flower },
  apricot_tree: { id: 'apricot_tree', cat: 'nature', label: 'アプリコット', icon: Flower },
  prickly_pear: { id: 'prickly_pear', cat: 'nature', label: 'トゥナ', icon: Flower },
  moss: { id: 'moss', cat: 'nature', label: '苔', icon: Sprout },

  // Events (3)
  harvester: { id: 'harvester', cat: 'events', label: 'ハーベスター', icon: Zap },
  raider_cache: { id: 'raider_cache', cat: 'events', label: 'レイダーの宝箱', icon: Package },
  wicker_basket: { id: 'wicker_basket', cat: 'events', label: 'バスケット', icon: Package },

  // Others (9)
  elevator: { id: 'elevator', cat: 'others', label: 'エレベーター', icon: Anchor },
  hatch: { id: 'hatch', cat: 'others', label: 'ハッチ', icon: DoorOpen },
  supply_call: { id: 'supply_call', cat: 'others', label: 'サプライコールステーション', icon: Radio },
  raider_camp: { id: 'raider_camp', cat: 'others', label: 'レイダーキャンプ', icon: Tent },
  field_depot: { id: 'field_depot', cat: 'others', label: 'フィールドデポ', icon: Briefcase },
  player_spawn: { id: 'player_spawn', cat: 'others', label: 'プレイヤーのスポーン位置', icon: User },
  quest: { id: 'quest', cat: 'others', label: 'クエスト', icon: MapPin },
  locked_room: { id: 'locked_room', cat: 'others', label: '鍵部屋', icon: Key },
  field_crate: { id: 'field_crate', cat: 'others', label: 'フィールド貯蔵庫', icon: Package },

  custom_pin: { id: 'custom_pin', cat: 'others', label: 'カスタムピン', icon: MapPin },
};

const FALLBACK_MARKER = { id: 'unknown', cat: 'others', label: 'その他', icon: CircleDot };

// 初期アイコンをユーザー提供のSVGに差し替え
const DEFAULT_MARKER_ICONS = {
  // Containers
  weapon_case: '/icon/weapon_case.svg',
  med_bag: '/icon/med_bag.svg',
  grenade_tube: '/icon/grenade_tube.svg',
  ammo_crate: '/icon/ammo_crate.svg',
  backpack: '/icon/backpack.svg',
  security_lockbox: '/icon/security_locker.svg',
  baron_husk: '/icon/baron_husk.svg',
  rocketeer_husk: '/icon/rocketeer_husk.svg',
  wasp_husk: '/icon/wasp_husk.svg',
  arc_courier: '/icon/arc_courier.svg',
  crashed_probe: '/icon/crashed_probe.svg',

  // Arc
  tick: '/icon/tick.svg',
  pop: '/icon/pop.svg',
  fireball: '/icon/fireball.svg',
  wasp: '/icon/wasp.png',
  hornet: '/icon/ho-netto.png',
  surveyor: '/icon/surveyor.svg',
  sentinel: '/icon/sentinel.svg',
  shredder: '/icon/syuretta-.png',
  rocketeer_arc: '/icon/rocketeer.svg',
  leaper: '/icon/leaper.svg',
  bombardier: '/icon/bombardier.svg',
  bastion: '/icon/bastion.svg',
  queen: '/icon/queen.svg',
  matriarch: '/icon/matoria-ku.png',

  // Nature
  mushrooms: '/icon/mushrooms.svg',
  great_mullein: '/icon/great_mullein.svg',
  agave: '/icon/agave.svg',
  apricot_tree: '/icon/apricot_tree.svg',
  prickly_pear: '/icon/prickly_pear.svg',
  moss: '/icon/moss.svg',

  // Events
  harvester: '/icon/harvester.svg',
  raider_cache: '/icon/raider_cache.svg',
  wicker_basket: '/icon/wicker_basket.svg',

  // Others
  elevator: '/icon/elevator.svg',
  hatch: '/icon/hatch.svg',
  supply_call: '/icon/supply_call_station.svg',
  raider_camp: '/icon/raider_camp.svg',
  field_depot: '/icon/field_depot.svg',
  player_spawn: '/icon/player_spawn.svg',
  quest: '/icon/quest.svg',
  locked_room: '/icon/locked_room.svg',
  field_crate: '/icon/field_crate.svg',
  custom_pin: '/icon/field_crate.svg',
};

// BASE_URL を考慮して /icon/ の先頭スラッシュを補正
const ICON_BASE = import.meta.env.BASE_URL || '/';
Object.keys(DEFAULT_MARKER_ICONS).forEach((k) => {
  const v = DEFAULT_MARKER_ICONS[k];
  if (typeof v === 'string' && v.startsWith('/')) {
    const normalized = v.replace(/^\//, '');
    DEFAULT_MARKER_ICONS[k] = `${ICON_BASE}${normalized}`;
  }
});
const DEFAULT_ICON_PATHS = new Set(Object.values(DEFAULT_MARKER_ICONS));

const makePresetIcon = (color, glyph = '') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${color}"/><text x="50%" y="54%" text-anchor="middle" font-size="28" fill="#0f172a" font-family="Arial, sans-serif" font-weight="700">${glyph}</text></svg>`,
  )}`;

const PRESET_ICONS = [
  { id: 'preset-orange', label: 'オレンジ', dataUrl: makePresetIcon('#fb923c', 'P') },
  { id: 'preset-blue', label: 'ブルー', dataUrl: makePresetIcon('#60a5fa', 'P') },
  { id: 'preset-green', label: 'グリーン', dataUrl: makePresetIcon('#34d399', 'P') },
  { id: 'preset-purple', label: 'パープル', dataUrl: makePresetIcon('#c084fc', 'P') },
  { id: 'preset-gray', label: 'グレー', dataUrl: makePresetIcon('#9ca3af', 'P') },
];

/* ========================================
  HELPER UTILS
  ========================================
*/

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const compressImage = (file, maxWidth = 600) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

/* ========================================
  COMPONENTS
  ========================================
*/

const TacticalGrid = ({ config, onUpload }) => (
  <div
    className="w-full h-full absolute top-0 left-0 flex flex-col items-center justify-center"
    style={{
      backgroundColor: config.bgColor,
      backgroundImage: `
        linear-gradient(${config.gridColor} 1px, transparent 1px),
        linear-gradient(90deg, ${config.gridColor} 1px, transparent 1px)
      `,
      backgroundSize: '100px 100px',
    }}
  >
    <div className="text-center p-4 sm:p-6 bg-black/50 backdrop-blur rounded-xl border border-gray-700 mx-4">
      <ImageIcon size={36} className="mx-auto text-gray-500 mb-3 sm:mb-4 sm:w-12 sm:h-12" />
      <p className="text-gray-300 font-bold mb-2 text-sm sm:text-base">NO MAP IMAGE</p>
      <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4 max-w-xs">
        セキュリティ制限のため、画像はローカルから選択してください。
      </p>
      <button
        onClick={onUpload}
        className="bg-orange-600 hover:bg-orange-500 text-white px-3 sm:px-4 py-2 rounded flex items-center gap-2 mx-auto transition-colors text-sm"
      >
        <Upload size={14} />
        マップ画像を選択
      </button>
    </div>
  </div>
);

const PinPopup = ({ pin, markerDef, onClose, onUpdateImage, onUpdateNote, onDelete, onMark, isMobile }) => {
  const categoryDef = MARKER_CATEGORIES[markerDef.cat] || MARKER_CATEGORIES.others;
  const [noteDraft, setNoteDraft] = useState(pin.note || '');
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!onUpdateImage) return;
    try {
      const compressedBase64 = await compressImage(file);
      onUpdateImage(pin.id, compressedBase64);
    } catch (err) {
      console.error('Image upload failed', err);
      alert('画像の処理に失敗しました');
    }
  };

  return (
    <div
      className={`fixed z-[100] bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 overflow-hidden
        ${isMobile ? 'inset-x-4 bottom-4 top-auto max-h-[70vh]' : 'w-72 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`relative ${isMobile ? 'h-32' : 'h-40'} bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer group hover:bg-gray-700 transition-colors`}
        onClick={() => fileInputRef.current?.click()}
      >
        {pin.imageUrl ? (
          <img src={pin.imageUrl} alt="Pin Attachment" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-500 group-hover:text-gray-400">
            <Camera size={28} className="mb-2 opacity-50" />
            <span className="text-xs">No Image</span>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />

      <div className="p-3 sm:p-4 overflow-y-auto max-h-[40vh]">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase mb-0.5">
              <markerDef.icon size={12} color={categoryDef.color} />
              {categoryDef.label}
            </div>
            <h3 className="text-base sm:text-lg font-bold leading-tight">{markerDef.label}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-gray-500 mb-3 sm:mb-4">
          投稿者: <span className="text-gray-300 font-semibold">{pin.createdByName || '不明'}</span>
          <span className="ml-2 text-gray-600">ID: {pin.id.slice(0, 6)}…</span>
        </div>
        
        <div className="flex flex-col gap-2 mb-3">
          <label className="text-[10px] text-gray-400">メモ</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className="w-full h-16 sm:h-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 resize-none"
            placeholder="ピンに紐づくメモを入力"
          />
          <div className="flex justify-end">
            <button
              onClick={() => onUpdateNote?.(pin.id, noteDraft)}
              className="text-xs px-3 py-1.5 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200"
            >
              保存
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onMark?.(pin.id)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2.5 rounded transition-colors flex items-center justify-center gap-2"
          >
            <MapPin size={14} />
            マークする
          </button>

          <button
            onClick={() => onDelete(pin.id)}
            className="bg-red-900/50 hover:bg-red-900 text-red-200 p-2.5 rounded transition-colors"
            title="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================
  MOBILE SIDEBAR COMPONENT
  ========================================
*/
const MobileSidebar = ({
  isOpen,
  onClose,
  searchTerm,
  setSearchTerm,
  openCategories,
  toggleCategory,
  mergedMarkers,
  markerIcons,
  markerCounts,
  isMarkerVisible,
  selectedTool,
  setSelectedTool,
  setMarkerVisibility,
  triggerIconUpload,
  showAllMarkers,
  hideAllMarkers,
  startAddCustomMarker,
  roomId,
  roomMode,
  roomInput,
  setRoomInput,
  modeChosen,
  applyRoomId,
  setShowSharedSetup,
  triggerFileUpload,
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900/98 backdrop-blur-lg border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out md:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-orange-500 w-5 h-5" />
              <span className="font-bold text-white">TACTICAL</span>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Search & Controls */}
          <div className="p-3 border-b border-gray-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-gray-700 rounded pl-8 pr-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            {/* Room ID Section */}
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 flex items-center justify-center font-bold">
                {roomMode === "local" ? "ローカル" : "共有"}
              </div>
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="ROOM ID"
                disabled={roomMode === "local" || (roomMode === "shared" && modeChosen)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 disabled:opacity-50"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTool('move')}
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-bold transition-colors border ${
                  selectedTool === 'move'
                    ? 'bg-gray-700 text-white border-gray-500'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                }`}
              >
                <Move size={14} />
                移動
              </button>
              <button
                onClick={triggerFileUpload}
                className="px-3 py-1.5 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500"
              >
                <ImageIcon size={14} />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={showAllMarkers}
                className="flex-1 py-1.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-xs font-bold"
              >
                全て表示
              </button>
              <button
                onClick={hideAllMarkers}
                className="flex-1 py-1.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-xs font-bold"
              >
                全て非表示
              </button>
            </div>
          </div>

          {/* Marker List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {Object.entries(MARKER_CATEGORIES).map(([catKey, category]) => (
              <div key={catKey} className="rounded overflow-hidden">
                <div className="w-full flex items-center justify-between px-2 py-2 bg-gray-800/50 text-xs font-bold text-gray-300">
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-white"
                  >
                    <span>{category.label}</span>
                    {openCategories[catKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <button
                    onClick={() => startAddCustomMarker(catKey)}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
                    title="このカテゴリにピンを追加"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {openCategories[catKey] && (
                  <div className="bg-black/20 p-1 space-y-0.5">
                    {Object.values(mergedMarkers)
                      .filter((m) => m.cat === catKey)
                      .filter((m) => m.label.includes(searchTerm))
                      .map((marker) => {
                        const MarkerIcon = marker.icon;
                        const isActive = selectedTool === marker.id;
                        const iconImage = markerIcons[marker.id];
                        const count = markerCounts[marker.id] || 0;
                        const visible = isMarkerVisible(marker.id);
                        return (
                          <div
                            key={marker.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedTool(marker.id);
                              onClose();
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-all cursor-pointer ${
                              isActive
                                ? 'bg-gray-700 text-white ring-1 ring-inset ring-gray-500'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                          >
                            {iconImage ? (
                              <img
                                src={iconImage}
                                alt={`${marker.label} icon`}
                                className="w-6 h-6 rounded-full object-cover border border-gray-600/60"
                              />
                            ) : (
                              <MarkerIcon size={18} color={category.color} />
                            )}
                            <span className="flex-1 text-left truncate">{marker.label}</span>
                            <span className="text-[11px] text-gray-400">{count}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerIconUpload(marker.id);
                                }}
                                className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                                title="アイコン変更"
                              >
                                <Camera size={10} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMarkerVisibility((prev) => ({ ...prev, [marker.id]: !visible }));
                                }}
                                className={`p-1 rounded border ${
                                  visible
                                    ? 'bg-gray-800 text-gray-300 border-gray-700'
                                    : 'bg-gray-900 text-gray-500 border-gray-800'
                                }`}
                              >
                                <EyeOff size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-800 text-[10px] text-gray-600 text-center">
            Room: {roomId || 'ローカル'}
          </div>
        </div>
      </div>
    </>
  );
};

/* ========================================
  MOBILE HEADER MENU
  ========================================
*/
const MobileHeaderMenu = ({
  isOpen,
  onClose,
  currentMap,
  setCurrentMap,
  activeProfile,
  setActiveProfile,
  profiles,
  addProfile,
  renameProfile,
  copyProfile,
  deleteProfile,
  displayName,
  setDisplayName,
  copyRoomLink,
  takeScreenshot,
  setModeChosen,
  roomId,
  setRoomId,
  setRoomMode,
  setRoomInput,
  lastSharedRoom,
}) => {
  const [newProfileName, setNewProfileName] = useState('');
  const [renameProfileNameLocal, setRenameProfileNameLocal] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute top-0 right-0 w-80 h-full bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="font-bold text-white">メニュー</span>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Map Selection */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400">マップ</label>
            <select
              value={currentMap}
              onChange={(e) => {
                setCurrentMap(e.target.value);
              }}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2"
            >
              {Object.values(MAP_CONFIG).map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>

          {/* Profile Selection */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400">プロファイル</label>
            <select
              value={activeProfile}
              onChange={(e) => setActiveProfile(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2"
            >
              {profiles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Profile Management */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <label className="text-xs text-gray-400">プロファイル管理</label>
            
            {/* Add Profile */}
            <div className="flex gap-2">
              <input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="新規プロファイル名"
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2"
              />
              <button
                onClick={() => {
                  addProfile(newProfileName || `攻略${profiles.length + 1}`);
                  setNewProfileName('');
                }}
                className="px-3 py-2 text-sm rounded bg-orange-600 hover:bg-orange-500 text-white"
              >
                <Plus size={16} />
              </button>
            </div>
            
            {/* Rename Profile */}
            <div className="flex gap-2">
              <input
                value={renameProfileNameLocal}
                onChange={(e) => setRenameProfileNameLocal(e.target.value)}
                placeholder="リネーム"
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2"
              />
              <button
                onClick={() => {
                  renameProfile(renameProfileNameLocal);
                  setRenameProfileNameLocal('');
                }}
                className="px-3 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                <Edit3 size={16} />
              </button>
            </div>
            
            {/* Copy & Delete */}
            <div className="flex gap-2">
              <button
                onClick={copyProfile}
                className="flex-1 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center gap-1"
              >
                <Copy size={14} />
                コピー
              </button>
              <button
                onClick={deleteProfile}
                disabled={profiles.length <= 1}
                className="flex-1 py-2 text-sm rounded bg-red-900/50 hover:bg-red-900 text-red-200 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Trash2 size={14} />
                削除
              </button>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <label className="text-xs text-gray-400">記載者名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
              placeholder="記載者名"
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <button
              onClick={() => {
                copyRoomLink();
                onClose();
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <Share2 size={16} />
              共有リンクをコピー
            </button>
            
            <button
              onClick={() => {
                takeScreenshot();
                onClose();
              }}
              className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <Download size={16} />
              スクリーンショット
            </button>

            <button
              onClick={() => {
                setModeChosen(false);
                setRoomMode("local");
                setRoomId(null);
                setRoomInput(lastSharedRoom || "");
                onClose();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <Home size={16} />
              モード選択へ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================
  MAIN APP COMPONENT
  ========================================
*/
const LAST_SHARED_ROOM_KEY = 'tactical_last_shared_room';

export default function App() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  
  const [user, setUser] = useState(null);
  const lastSharedRoom = (() => {
    try {
      return localStorage.getItem(LAST_SHARED_ROOM_KEY) || '';
    } catch {
      return '';
    }
  })();
  const [roomId, setRoomId] = useState(null);
  const [currentMap, setCurrentMap] = useState('dam');
  const [currentLayer, setCurrentLayer] = useState(null);
  const [localImages, setLocalImages] = useState({});

  const [sharedPins, setSharedPins] = useState([]);
  const [localPins, setLocalPins] = useState([]);
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [markedPinIds, setMarkedPinIds] = useState([]);
  const [markerVisibility, setMarkerVisibility] = useState({});
  const [markerIcons, setMarkerIcons] = useState({});
  const [customMarkers, setCustomMarkers] = useState([]);
  const [iconTargetMarker, setIconTargetMarker] = useState(null);
  const [showMarkerDialog, setShowMarkerDialog] = useState(false);
  const [newMarkerCat, setNewMarkerCat] = useState(null);
  const [newMarkerName, setNewMarkerName] = useState('');
  const [newMarkerIcon, setNewMarkerIcon] = useState(null);
  const [userIconLibrary, setUserIconLibrary] = useState([]);
  const [resetTargetId, setResetTargetId] = useState('');
  const [isResettingIcon, setIsResettingIcon] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#7dd3fc');
  const [deleteIconTargetId, setDeleteIconTargetId] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedTool, setSelectedTool] = useState('move');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.4 });
  const [iconBaseScale, setIconBaseScale] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isDeletingPins, setIsDeletingPins] = useState(false);
  const [deleteTargetType, setDeleteTargetType] = useState('');
  const [savedRooms, setSavedRooms] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showShareToast, setShowShareToast] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [roomMode, setRoomMode] = useState('local');
  const [roomInput, setRoomInput] = useState(lastSharedRoom || '');
  const [modeChosen, setModeChosen] = useState(false);
  const [showSharedSetup, setShowSharedSetup] = useState(false);
  const [roomCreator, setRoomCreator] = useState(false);
  const [activeProfile, setActiveProfile] = useState('default');
  const [newProfileName, setNewProfileName] = useState('');
  const [renameProfileName, setRenameProfileName] = useState('');
  const [localMapMeta, setLocalMapMeta] = useState({});
  const [sharedMapMeta, setSharedMapMeta] = useState({});
  const [roomInfo, setRoomInfo] = useState(null);
  const [roomInfoLoading, setRoomInfoLoading] = useState(false);
  
  // Mobile-specific states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Touch handling states
  const [touchState, setTouchState] = useState({
    touches: [],
    lastDistance: null,
    lastCenter: null,
  });

  const roomDocRef = useMemo(
    () => (db && roomId ? doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId) : null),
    [roomId],
  );
  const [modeError, setModeError] = useState('');
  const pendingEntries = roomInfo?.pending || [];
  const normalizedPending = useMemo(
    () =>
      pendingEntries.map((p) =>
        typeof p === 'string' ? { uid: p, name: p } : { uid: p?.uid, name: p?.name || p?.uid || 'guest' },
      ),
    [pendingEntries],
  );
  const isPendingSelf = useMemo(
    () => Boolean(user && normalizedPending.find((p) => p.uid === user.uid)),
    [user, normalizedPending],
  );
  const activeMode = roomMode === 'shared' && roomId ? 'shared' : 'local';
  const isOwner = useMemo(() => Boolean(user && roomInfo && roomInfo.ownerUid === user.uid), [user, roomInfo]);
  const allowedUsers = roomInfo?.allowedUsers || [];
  const isApproved = useMemo(() => {
    if (activeMode !== 'shared') return true;
    if (!roomId) return false;
    if (!roomInfo) return roomCreator;
    if (!user) return true;
    if (roomInfo.ownerUid === user.uid) return true;
    return allowedUsers.includes(user.uid);
  }, [activeMode, roomId, user, roomInfo, allowedUsers, roomCreator]);
  const pins = activeMode === 'shared' ? sharedPins : localPins;
  const setPinsForMode = (updater, mode = activeMode) => {
    if (mode === 'shared') {
      setSharedPins((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    } else {
      setLocalPins((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    }
  };

  const canSync = useMemo(() => useFirebase && Boolean(roomId) && isApproved, [roomId, isApproved]);
  const rateLimitRef = useRef({ pinAdd: 0, noteUpdate: 0, imageUpdate: 0 });

  const [openCategories, setOpenCategories] = useState({
    containers: true,
    arc: true,
    others: true,
    nature: true,
    events: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const customPinIcon = markerIcons['custom_pin'] || null;
  const mergedCategories = useMemo(() => {
    const cats = { ...MARKER_CATEGORIES };
    customCategories.forEach((c) => {
      cats[c.id] = { label: c.label, color: c.color || '#6b7280' };
    });
    return cats;
  }, [customCategories]);
  const mergedMarkers = useMemo(() => {
    const base = { ...MARKERS };
    customMarkers.forEach((m) => {
      base[m.id] = { ...m, icon: MapPin };
    });
    return base;
  }, [customMarkers]);

  const addRoomToHistory = useCallback(
    (id, role = 'member') => {
      if (!id) return;
      setSavedRooms((prev) => {
        const existing = prev.find((r) => r.id === id);
        const nextRole = existing
          ? existing.role === 'owner' || role === 'owner'
            ? 'owner'
            : existing.role
          : role;
        if (!existing && nextRole === 'owner') {
          const ownerCount = prev.filter((r) => r.role === 'owner').length;
          if (ownerCount >= MAX_OWNER_ROOMS) return prev;
        }
        const filtered = prev.filter((r) => r.id !== id);
        return [{ id, role: nextRole, savedAt: Date.now() }, ...filtered].slice(0, 30);
      });
    },
    [setSavedRooms],
  );

  const removeRoomFromHistory = useCallback(
    (id) => {
      setSavedRooms((prev) => prev.filter((r) => r.id !== id));
    },
    [setSavedRooms],
  );

  useEffect(() => {
    if (activeMode !== 'shared') {
      setApprovalMessage('');
      return;
    }
    if (isOwner) {
      setApprovalMessage('');
      return;
    }
    if (!isApproved && isPendingSelf) {
      setApprovalMessage('オーナーの承認待ちです。承認されるまで操作できません。');
    } else if (!isApproved) {
      setApprovalMessage('オーナーの承認が必要です。参加リクエストを送信しました。');
    } else {
      setApprovalMessage('');
    }
  }, [activeMode, isOwner, isApproved, isPendingSelf]);
  const availableIcons = [...userIconLibrary, ...PRESET_ICONS];
  const isMarkerVisible = (markerId) => markerVisibility[markerId] !== false;
  const markerCounts = useMemo(() => {
    const counts = {};
    pins.forEach((p) => {
      if (p.mapId !== currentMap) return;
      const cfg = MAP_CONFIG[currentMap];
      if (cfg.layers && p.layerId !== currentLayer) return;
      counts[p.type] = (counts[p.type] || 0) + 1;
    });
    return counts;
  }, [pins, currentMap, currentLayer]);

  const mapRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);
  const newMarkerIconInputRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem('tactical_display_name');
    if (savedName) setDisplayName(savedName);
  }, []);

  useEffect(() => {
    if (!resetTargetId && Object.keys(mergedMarkers).length > 0) {
      setResetTargetId(Object.keys(mergedMarkers)[0]);
    }
  }, [mergedMarkers, resetTargetId]);

  useEffect(() => {
    if (displayName) localStorage.setItem('tactical_display_name', displayName);
  }, [displayName]);

  useEffect(() => {
    const savedMarkers = localStorage.getItem('tactical_custom_markers');
    if (savedMarkers) {
      try {
        const parsed = JSON.parse(savedMarkers);
        if (Array.isArray(parsed)) setCustomMarkers(parsed);
      } catch (err) {
        console.warn('Failed to parse stored custom markers', err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tactical_custom_markers', JSON.stringify(customMarkers || []));
  }, [customMarkers]);

  useEffect(() => {
    if (!markedPinIds.length) return;
    const pinIds = new Set(pins.map((p) => p.id));
    setMarkedPinIds((prev) => prev.filter((id) => pinIds.has(id)));
  }, [pins, markedPinIds]);

  // reset pin rate limit when部屋を切り替え
  useEffect(() => {
    rateLimitRef.current.pinAdd = 0;
  }, [roomId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((r) => {
              if (!r) return null;
              if (typeof r === 'string') return { id: r, role: 'member', savedAt: Date.now() };
              return {
                id: r.id,
                role: r.role === 'owner' ? 'owner' : 'member',
                savedAt: r.savedAt || Date.now(),
              };
            })
            .filter((r) => r && r.id);
          setSavedRooms(normalized);
        }
      }
    } catch (err) {
      console.warn('Failed to load saved rooms', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(savedRooms));
    } catch (err) {
      console.warn('Failed to persist saved rooms', err);
    }
  }, [savedRooms]);

  useEffect(() => {
    const savedLibrary = localStorage.getItem('tactical_user_icon_library');
    if (savedLibrary) {
      try {
        const parsed = JSON.parse(savedLibrary);
        if (Array.isArray(parsed)) setUserIconLibrary(parsed);
      } catch (err) {
        console.warn('Failed to parse stored icon library', err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tactical_user_icon_library', JSON.stringify(userIconLibrary || []));
  }, [userIconLibrary]);

  useEffect(() => {
    const savedIcons = localStorage.getItem('tactical_marker_icons');
    if (savedIcons) {
      try {
        const parsed = JSON.parse(savedIcons);
        if (parsed && typeof parsed === 'object') {
          const merged = { ...DEFAULT_MARKER_ICONS };
          Object.entries(parsed).forEach(([key, val]) => {
            if (!val) return;
            const isDataUrl = typeof val === 'string' && val.startsWith('data:');
            const isHttp = typeof val === 'string' && val.startsWith('http');
            const isKnownPath = typeof val === 'string' && DEFAULT_ICON_PATHS.has(val);
            if (val.startsWith('/icon/') && !isKnownPath) return;
            if (isDataUrl || isHttp || isKnownPath) merged[key] = val;
          });
          setMarkerIcons(merged);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse stored marker icons', err);
      }
    }
    setMarkerIcons(DEFAULT_MARKER_ICONS);
  }, []);

  useEffect(() => {
    localStorage.setItem('tactical_marker_icons', JSON.stringify(markerIcons || {}));
  }, [markerIcons]);

  useEffect(() => {
    const initAuth = async () => {
      if (!useFirebase) {
        setUser({ uid: 'local-demo' });
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();
    if (!useFirebase) return undefined;
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const mapParam = params.get('map');
    const profileParam = params.get('profile');
    if (roomParam) {
      setRoomId(roomParam);
      setRoomMode('shared');
      setRoomCreator(false);
      setRoomInput(roomParam);
      setModeChosen(true);
      try {
        localStorage.setItem(LAST_SHARED_ROOM_KEY, roomParam);
      } catch {}
    }
    if (mapParam && MAP_CONFIG[mapParam]) setCurrentMap(mapParam);
    if (profileParam) setActiveProfile(profileParam);
    const savedLocalPins = localStorage.getItem('tactical_local_pins');
    if (savedLocalPins) {
      try {
        const parsed = JSON.parse(savedLocalPins);
        if (Array.isArray(parsed)) setLocalPins(parsed);
      } catch (err) {
        console.warn('Failed to parse local pins', err);
      }
    }
    const savedMapMeta = localStorage.getItem('tactical_local_map_meta');
    if (savedMapMeta) {
      try {
        const parsed = JSON.parse(savedMapMeta);
        if (parsed && typeof parsed === 'object') setLocalMapMeta(parsed);
      } catch (err) {
        console.warn('Failed to parse local map meta', err);
      }
    }
  }, []);

  // Room info (owner/allowed/pending)
  useEffect(() => {
    if (!useFirebase || !roomId || !db) {
      setRoomInfo(null);
      return undefined;
    }
    setRoomInfoLoading(true);
    if (!roomDocRef) return undefined;
    const unsub = onSnapshot(
      roomDocRef,
      (snap) => {
        setRoomInfo(snap.exists() ? snap.data() : null);
        setRoomInfoLoading(false);
      },
      (err) => {
        console.error('Room info subscribe error', err);
        setRoomInfoLoading(false);
      },
    );
    return () => unsub();
  }, [roomId, useFirebase, roomDocRef]);

  // Ensure room doc exists & owner is allowed
  useEffect(() => {
    const ensureRoom = async () => {
      if (!useFirebase || !roomId || !db || !user) return;
      try {
        if (!roomInfo) {
          if (!roomCreator) return;
          await setDoc(roomDocRef, {
            roomId,
            ownerUid: user.uid,
            allowedUsers: [user.uid],
            pending: [],
            createdAt: serverTimestamp(),
            expiresAt: ttlTimestamp(PIN_LIMITS.roomTtlMs),
            lastActiveAt: serverTimestamp(),
          });
          return;
        }
        if (roomInfo.ownerUid === user.uid) {
          const patch = { allowedUsers: roomInfo.allowedUsers?.includes(user.uid) ? roomInfo.allowedUsers : arrayUnion(user.uid) };
          await updateDoc(roomDocRef, {
            ...patch,
            lastActiveAt: serverTimestamp(),
            expiresAt: ttlTimestamp(PIN_LIMITS.roomTtlMs),
          });
        }
      } catch (err) {
        console.error('Ensure room failed', err);
        setActionMessage('権限エラー: Firestore ルールと appId を確認してください。');
      }
    };
    ensureRoom();
  }, [roomId, user, roomInfo, useFirebase, roomDocRef, roomCreator]);

  // If visitor is not approved, add to pending
  useEffect(() => {
    const sendPending = async () => {
      if (!useFirebase || !roomId || !db || !user) return;
      if (!roomInfo) return;
      if (roomInfo.ownerUid === user.uid) return;
      const alreadyAllowed = roomInfo.allowedUsers?.includes(user.uid);
      const pendingArr = roomInfo.pending || [];
      const alreadyPending = pendingArr.some((p) => (typeof p === 'string' ? p === user.uid : p?.uid === user.uid));
      if (!alreadyAllowed && !alreadyPending) {
        try {
          await updateDoc(roomDocRef, {
            pending: arrayUnion({
              uid: user.uid,
              name: displayName || 'guest',
            }),
          });
        } catch (err) {
          console.error('Add pending failed', err);
          setActionMessage('権限エラー: オーナーに許可を依頼できません。');
        }
      }
    };
    sendPending();
  }, [roomId, user, roomInfo, useFirebase, displayName, roomDocRef]);

  const centerMap = useCallback(() => {
    const containerW = windowWidth;
    const containerH = windowHeight;
    const config = MAP_CONFIG[currentMap];
    const initialScale = isMobile ? 0.25 : 0.4;
    setTransform({
      x: containerW / 2 - (config.width * initialScale) / 2,
      y: containerH / 2 - (config.height * initialScale) / 2,
      scale: initialScale,
    });
  }, [windowWidth, windowHeight, currentMap, isMobile]);

  useEffect(() => {
    const config = MAP_CONFIG[currentMap];
    if (config.layers && config.layers.length > 0) setCurrentLayer(config.layers[0].id);
    else setCurrentLayer(null);
    centerMap();
    const params = new URLSearchParams(window.location.search);
    params.set('map', currentMap);
    params.set('profile', activeProfile);
    if (roomId) params.set('room', roomId);
    else params.delete('room');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentMap, activeProfile, roomId, centerMap]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('map', currentMap);
    params.set('profile', activeProfile);
    if (roomId) params.set('room', roomId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeProfile, currentMap, roomId]);

  // Persist local pins
  useEffect(() => {
    localStorage.setItem('tactical_local_pins', JSON.stringify(localPins || []));
  }, [localPins]);

  // Persist local map meta
  useEffect(() => {
    localStorage.setItem('tactical_local_map_meta', JSON.stringify(localMapMeta || {}));
  }, [localMapMeta]);

  useEffect(() => {
    if (!canSync || activeMode !== 'shared' || !auth || !db || !user) return;
    const collectionName = `${roomId}_pins`;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedPins = snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, roomId: data.roomId || roomId };
        });
        setSharedPins(loadedPins);
      },
      (error) => console.error(error),
    );
    return () => unsubscribe();
  }, [user, roomId, canSync, activeMode]);

  useEffect(() => {
    if (!canSync || activeMode !== 'shared' || !auth || !db || !user) return;
    const collectionName = `${roomId}_mapmeta`;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded = {};
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          loaded[docSnap.id] = { ...data, roomId: data.roomId || roomId };
        });
        setSharedMapMeta(loaded);
      },
      (error) => console.error(error),
    );
    return () => unsubscribe();
  }, [user, roomId, activeMode, canSync]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const key = currentLayer ? `${currentMap}_${currentLayer}` : currentMap;
    setLocalImages((prev) => ({ ...prev, [key]: objectUrl }));
  };
  const triggerFileUpload = () => fileInputRef.current?.click();

  const handleIconFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !iconTargetMarker) return;
    try {
      const compressed = await compressImage(file, 128);
      setMarkerIcons((prev) => ({ ...prev, [iconTargetMarker]: compressed }));
      addIconToLibrary(compressed);
    } catch (err) {
      console.error('Icon upload failed', err);
      alert('Icon image could not be loaded.');
    } finally {
      e.target.value = '';
      setIconTargetMarker(null);
    }
  };
  const triggerIconUpload = (markerId = 'custom_pin') => {
    setIconTargetMarker(markerId);
    iconFileInputRef.current?.click();
  };
  const addIconToLibrary = (dataUrl) => {
    if (!dataUrl) return;
    setUserIconLibrary((prev) => {
      if (prev.some((icon) => icon.dataUrl === dataUrl)) return prev;
      const id = `user_${prev.length + 1}_${Date.now().toString(36)}`;
      return [...prev, { id, label: 'My Icon', dataUrl }];
    });
  };

  const resetMarkerIcon = async (markerId) => {
    const defaultIcon = DEFAULT_MARKER_ICONS[markerId];
    if (!defaultIcon) return;
    setIsResettingIcon(true);
    setMarkerIcons((prev) => ({ ...prev, [markerId]: defaultIcon }));
    setPinsForMode((prev) => prev.map((p) => (p.type === markerId ? { ...p, iconUrl: defaultIcon } : p)));

    if (canSync && roomId) {
      const collectionName = `${roomId}_pins`;
      const targets = pins.filter((p) => p.type === markerId);
      await Promise.allSettled(
        targets.map((p) =>
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, p.id), {
            iconUrl: defaultIcon,
          }),
        ),
      );
    }
    setIsResettingIcon(false);
  };
  
  const startAddCustomMarker = (catKey) => {
    setNewMarkerCat(catKey);
    setNewMarkerName('');
    setNewMarkerIcon(markerIcons['custom_pin'] || availableIcons[0]?.dataUrl || null);
    setShowMarkerDialog(true);
  };

  const handleNewMarkerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 128);
      setNewMarkerIcon(compressed);
      addIconToLibrary(compressed);
    } catch (err) {
      console.error('Marker icon upload failed', err);
      alert('アイコン画像を読み込めませんでした');
    } finally {
      e.target.value = '';
    }
  };

  const confirmAddCustomMarker = () => {
    if (!newMarkerName.trim() || !newMarkerCat) {
      alert('ピン名を入力してください');
      return;
    }
    const id = `custom_${Date.now().toString(36)}`;
    const marker = { id, label: newMarkerName.trim(), cat: newMarkerCat };
    setCustomMarkers((prev) => [...prev, marker]);
    if (newMarkerIcon) {
      setMarkerIcons((prev) => ({ ...prev, [id]: newMarkerIcon }));
    }
    setSelectedTool(id);
    setShowMarkerDialog(false);
  };

  const setZoom = useCallback((newScale, focal) => {
    const s = Math.min(Math.max(0.15, newScale), 5);
    const focalX = focal?.x ?? windowWidth / 2;
    const focalY = focal?.y ?? windowHeight / 2;

    setTransform((prev) => {
      const mapCenterX = (focalX - prev.x) / prev.scale;
      const mapCenterY = (focalY - prev.y) / prev.scale;
      const newX = focalX - mapCenterX * s;
      const newY = focalY - mapCenterY * s;
      return { x: newX, y: newY, scale: s };
    });
  }, [windowWidth, windowHeight]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const scaleSensitivity = 0.001;
    const newScale = transform.scale - e.deltaY * scaleSensitivity;
    setZoom(newScale, { x: e.clientX, y: e.clientY });
  }, [transform.scale, setZoom]);

  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y });
      setTouchState({ touches: [touch], lastDistance: null, lastCenter: null });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
      setTouchState({ touches: [touch1, touch2], lastDistance: distance, lastCenter: center });
      setIsDragging(false);
    }
  }, [transform.x, transform.y]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setTransform((prev) => ({
        ...prev,
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      }));
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      if (touchState.lastDistance !== null) {
        const scaleDelta = distance / touchState.lastDistance;
        const newScale = transform.scale * scaleDelta;
        setZoom(newScale, center);
      }

      if (touchState.lastCenter !== null) {
        const deltaX = center.x - touchState.lastCenter.x;
        const deltaY = center.y - touchState.lastCenter.y;
        setTransform((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      }

      setTouchState({ touches: [touch1, touch2], lastDistance: distance, lastCenter: center });
    }
  }, [isDragging, dragStart, touchState, transform.scale, setZoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchState({ touches: [], lastDistance: null, lastCenter: null });
  }, []);

  const handleMouseDown = (e) => {
    if (e.button === 1 || selectedTool === 'move') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setTransform((prev) => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleMapClick = async (e) => {
    if (e.target.closest('.pin-element')) return;
    if (isDragging) return;
    setActionMessage('');
    
    if (activeMode === 'shared' && (!user || !roomId)) {
      if (useFirebase && auth) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Auth retry failed', err);
        }
      }
      alert('共有モードでピンを置くにはRoom接続とサインインが必要です。');
      return;
    }

    if (selectedPinId) {
      setSelectedPinId(null);
      return;
    }

    if (selectedTool === 'move') return;

    const mapDef = MAP_CONFIG[currentMap];
    if (!mapDef) {
      setActionMessage('マップ設定に問題があります。');
      return;
    }
    if (!isLayerValidForMap(mapDef, currentLayer)) {
      setActionMessage('レイヤー設定に問題があります。');
      return;
    }
    if (!mergedMarkers[selectedTool]) {
      setActionMessage('このマーカーは使用できません。');
      return;
    }
    const now = Date.now();
    const lastPin = rateLimitRef.current.pinAdd || 0;
    const safeLastPin = lastPin > now ? 0 : lastPin; // 時計ずれや異常値をリセット
    if (now - safeLastPin < PIN_LIMITS.rate.pinAddMs) {
      setActionMessage('ピン作成が速すぎます。少しだけ間隔を空けてください。');
      return;
    }

    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / transform.scale;
    const y = (e.clientY - rect.top) / transform.scale;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < 0 || y < 0 || x > mapDef.width || y > mapDef.height) {
      setActionMessage('座標がマップ外です。');
      return;
    }
    const currentPinCount = pins.length;
    if (currentPinCount >= PIN_LIMITS.maxPinsPerRoom) {
      setActionMessage(`ピン数の上限です。最大 ${PIN_LIMITS.maxPinsPerRoom} 件までです。`);
      return;
    }

    if (!canSync || activeMode === 'local') {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPinsForMode((prev) => [
        ...prev,
        {
          id: localId,
          roomId: roomId || 'local',
          mapId: currentMap,
          layerId: currentLayer,
          x,
          y,
          type: selectedTool,
          iconUrl: markerIcons[selectedTool] || undefined,
          profileId: activeProfile,
          note: '',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + PIN_LIMITS.pinTtlMs),
          createdBy: user?.uid || 'local',
          createdByName: displayName || '匿名',
        },
      ]);
      setSelectedPinId(localId);
      setSelectedTool('move');
      rateLimitRef.current.pinAdd = now;
      return;
    }

    if (!roomId) return;

    try {
      const collectionName = `${roomId}_pins`;
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), {
        roomId,
        mapId: currentMap,
        layerId: currentLayer,
        x,
        y,
        type: selectedTool,
        iconUrl: markerIcons[selectedTool] || undefined,
        profileId: activeProfile,
        note: '',
        createdAt: serverTimestamp(),
        expiresAt: ttlTimestamp(PIN_LIMITS.pinTtlMs),
        createdBy: user.uid,
        createdByName: displayName || '匿名',
      });
      setSelectedPinId(docRef.id);
      setSelectedTool('move');
      rateLimitRef.current.pinAdd = now;
    } catch (err) {
      console.error('Error adding pin:', err);
      setActionMessage('権限エラー: ピン作成が拒否されました。FirestoreルールとappIdを確認してください。');
    }
  };

  const handlePinClick = (e, pinId) => {
    e.stopPropagation();
    setSelectedPinId((prev) => (prev === pinId ? null : pinId));
  };

  const deletePin = async (pinId) => {
    if (!user && activeMode === 'shared') return;
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.filter((p) => p.id !== pinId));
      if (selectedPinId === pinId) setSelectedPinId(null);
      setMarkedPinIds((prev) => prev.filter((id) => id !== pinId));
      return;
    }
    const collectionName = `${roomId}_pins`;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId));
      if (selectedPinId === pinId) setSelectedPinId(null);
      setMarkedPinIds((prev) => prev.filter((id) => id !== pinId));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAllRoomPins = async () => {
    if (!isOwner || !roomId || !db) {
      alert('オーナーだけが実行できます。');
      return;
    }
    if (activeMode !== 'shared') {
      alert('共有モードのときのみ実行できます。');
      return;
    }
    if (!window.confirm('このルームのピンをすべて削除します。よろしいですか？')) return;
    setIsDeletingPins(true);
    setActionMessage('削除中...');
    try {
      const collectionName = `${roomId}_pins`;
      const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
      const batchSize = 400;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const slice = docs.slice(i, i + batchSize);
        const batch = writeBatch(db);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setSharedPins([]);
      setSelectedPinId(null);
      setActionMessage(`削除しました: ${docs.length} 件`);
    } catch (err) {
      console.error('Delete all pins failed', err);
      setActionMessage('削除に失敗しました');
    } finally {
      setTimeout(() => setActionMessage(''), 3000);
      setIsDeletingPins(false);
    }
  };

  const deletePinsByType = async () => {
    if (!isOwner || !roomId || !db) {
      alert('オーナーだけが実行できます。');
      return;
    }
    if (activeMode !== 'shared') {
      alert('共有モードのときのみ実行できます。');
      return;
    }
    const targetType = deleteTargetType || resetTargetId || '';
    if (!targetType) {
      alert('削除するピンタイプを選んでください。');
      return;
    }
    if (!window.confirm(`タイプ「${targetType}」のピンをすべて削除します。よろしいですか？（取り消せません）`)) return;
    setIsDeletingPins(true);
    setActionMessage('削除中...');
    try {
      const collectionName = `${roomId}_pins`;
      const snap = await getDocs(
        query(collection(db, 'artifacts', appId, 'public', 'data', collectionName), where('type', '==', targetType)),
      );
      const docs = snap.docs;
      const batchSize = 400;
      for (let i = 0; i < docs.length; i += batchSize) {
        const slice = docs.slice(i, i + batchSize);
        const batch = writeBatch(db);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setSharedPins((prev) => prev.filter((p) => p.type !== targetType));
      setSelectedPinId(null);
      setActionMessage(`削除しました: ${docs.length} 件`);
    } catch (err) {
      console.error('Delete pins by type failed', err);
      setActionMessage('削除に失敗しました');
    } finally {
      setTimeout(() => setActionMessage(''), 3000);
      setIsDeletingPins(false);
    }
  };

  const deleteCurrentRoomData = async () => {
    if (!isOwner || !roomId || !db) {
      alert('オーナーだけが実行できます。');
      return;
    }
    if (!window.confirm('このルームをまるごと削除します。ピン/マップメタ/ルーム情報も消えます。よろしいですか？')) return;
    setIsDeletingPins(true);
    setActionMessage('ルーム削除中...');
    try {
      const pinsCol = `${roomId}_pins`;
      const mapmetaCol = `${roomId}_mapmeta`;
      const pinsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', pinsCol));
      const metaSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', mapmetaCol));
      const batchSize = 400;
      const eraseDocs = async (docs) => {
        for (let i = 0; i < docs.length; i += batchSize) {
          const slice = docs.slice(i, i + batchSize);
          const batch = writeBatch(db);
          slice.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      };
      await eraseDocs(pinsSnap.docs);
      await eraseDocs(metaSnap.docs);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId));
      setSharedPins([]);
      setSharedMapMeta({});
      setRoomInfo(null);
      removeRoomFromHistory(roomId);
      applyRoomId(null);
      setActionMessage('ルームを削除しました');
    } catch (err) {
      console.error('Delete room failed', err);
      setActionMessage('ルーム削除に失敗しました');
    } finally {
      setTimeout(() => setActionMessage(''), 3000);
      setIsDeletingPins(false);
    }
  };

  const updatePinNote = async (pinId, noteText) => {
    const safeNote = typeof noteText === 'string' ? noteText : '';
    if (safeNote.length > PIN_LIMITS.maxNoteLength) {
      alert(`ノートは ${PIN_LIMITS.maxNoteLength} 文字までにしてください。`);
      return;
    }
    const now = Date.now();
    if (now - rateLimitRef.current.noteUpdate < PIN_LIMITS.rate.noteUpdateMs) {
      setActionMessage('ノート変更の間隔が短すぎます。');
      return;
    }
    rateLimitRef.current.noteUpdate = now;
    if (!user && activeMode === 'shared') {
      setActionMessage('保存に失敗');
      setTimeout(() => setActionMessage(''), 2000);
      return;
    }
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.map((p) => (p.id === pinId ? { ...p, note: safeNote } : p)));
      setActionMessage('保存完了');
      setTimeout(() => setActionMessage(''), 2000);
      return;
    }
    if (!roomId) {
      setActionMessage('保存に失敗');
      setTimeout(() => setActionMessage(''), 2000);
      return;
    }
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        note: safeNote,
      });
      setActionMessage('保存完了');
    } catch (err) {
      console.error(err);
      setActionMessage('保存に失敗');
    } finally {
      setTimeout(() => setActionMessage(''), 2000);
    }
  };

  const updatePinImage = async (pinId, dataUrl) => {
    if (dataUrl && estimateDataUrlBytes(dataUrl) > PIN_LIMITS.maxImageBytes) {
      alert(`画像サイズの上限(${Math.floor(PIN_LIMITS.maxImageBytes / 1024)}KB)を超えています。`);
      return;
    }
    const now = Date.now();
    if (now - rateLimitRef.current.imageUpdate < PIN_LIMITS.rate.imageUpdateMs) {
      setActionMessage('画像更新の間隔が短すぎます。少し待ってください。');
      return;
    }
    rateLimitRef.current.imageUpdate = now;
    if (!user && activeMode === 'shared') return;
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.map((p) => (p.id === pinId ? { ...p, imageUrl: dataUrl } : p)));
      return;
    }
    if (!roomId) return;
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        imageUrl: dataUrl,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const visiblePins = pins.filter((p) => {
    if (roomId && p.roomId && p.roomId !== roomId) return false;
    if (p.mapId !== currentMap) return false;
    const pinProfile = p.profileId || 'default';
    if (pinProfile !== activeProfile) return false;
    const config = MAP_CONFIG[currentMap];
    if (!config) return false;
    if (config.layers && p.layerId !== currentLayer) return false;
    if (!isMarkerVisible(p.type)) return false;
    return true;
  });

  const toggleCategory = (catKey) => {
    setOpenCategories((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const showAllMarkers = () => {
    const next = {};
    Object.keys(mergedMarkers).forEach((id) => {
      next[id] = true;
    });
    setMarkerVisibility(next);
  };

  const hideAllMarkers = () => {
    const next = {};
    Object.keys(mergedMarkers).forEach((id) => {
      next[id] = false;
    });
    setMarkerVisibility(next);
  };

  const resetAllIcons = () => {
    setMarkerIcons(DEFAULT_MARKER_ICONS);
    localStorage.setItem('tactical_marker_icons', JSON.stringify(DEFAULT_MARKER_ICONS));
  };

  const mapMeta = activeMode === 'shared' ? sharedMapMeta : localMapMeta;
  const currentMapMeta = mapMeta[currentMap] || { title: '', note: '', profiles: ['default'] };
  const profiles = currentMapMeta.profiles && currentMapMeta.profiles.length > 0 ? currentMapMeta.profiles : ['default'];
  const setMapMetaForMode = (mapId, updater) => {
    if (activeMode === 'shared') {
      setSharedMapMeta((prevMeta) => (typeof updater === 'function' ? updater(prevMeta) : updater));
    } else {
      setLocalMapMeta((prevMeta) => (typeof updater === 'function' ? updater(prevMeta) : updater));
    }
  };

  useEffect(() => {
    if (!profiles.includes(activeProfile)) {
      setActiveProfile(profiles[0] || 'default');
    }
  }, [currentMap, profiles, activeProfile]);

  const updateMapMeta = async (mapId, partial) => {
    const prev = mapMeta[mapId] || {};
    const baseNext = { ...prev, ...partial, updatedAt: Date.now(), updatedBy: user?.uid || 'local', updatedByName: displayName || 'ローカル' };
    if (activeMode === 'shared') {
      if (!canSync || !roomId || !user || !db) return;
      const collectionName = `${roomId}_mapmeta`;
      const payload = { ...baseNext, roomId, expiresAt: ttlTimestamp(PIN_LIMITS.pinTtlMs) };
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, mapId), payload).catch(async (err) => {
          if (err.code === 'not-found' || String(err).includes('No document')) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, mapId), payload);
          } else {
            throw err;
          }
        });
        setSharedMapMeta((prevMeta) => ({ ...prevMeta, [mapId]: payload }));
      } catch (err) {
        console.error('Map meta update failed', err);
      }
    } else {
      setLocalMapMeta((prevMeta) => ({ ...prevMeta, [mapId]: baseNext }));
    }
  };

  const addProfile = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const list = Array.from(new Set([...profiles, trimmed]));
    if (list.length > PIN_LIMITS.maxProfilesPerRoom) {
      alert(`プロフィールは最大 ${PIN_LIMITS.maxProfilesPerRoom} 件までです。`);
      return;
    }
    setMapMetaForMode(currentMap, (prev) => {
      const meta = prev[currentMap] || {};
      return { ...prev, [currentMap]: { ...meta, profiles: list } };
    });
    updateMapMeta(currentMap, { profiles: list });
    setActiveProfile(trimmed);
  };

  const renameProfile = async (nextName) => {
    const trimmed = (nextName || '').trim();
    if (!trimmed || trimmed === activeProfile) return;
    if (profiles.includes(trimmed)) {
      setActiveProfile(trimmed);
      return;
    }
    const nextList = profiles.map((p) => (p === activeProfile ? trimmed : p));
    setMapMetaForMode(currentMap, (prev) => {
      const meta = prev[currentMap] || {};
      return { ...prev, [currentMap]: { ...meta, profiles: nextList } };
    });
    updateMapMeta(currentMap, { profiles: nextList });
    if (activeMode === 'local') {
      setLocalPins((prev) =>
        prev.map((p) =>
          p.mapId === currentMap && (p.profileId || 'default') === activeProfile
            ? { ...p, profileId: trimmed }
            : p,
        ),
      );
    } else {
      const targets = sharedPins.filter(
        (p) => p.mapId === currentMap && (p.profileId || 'default') === activeProfile,
      );
      const collectionName = `${roomId}_pins`;
      await Promise.allSettled(
        targets.map((p) =>
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, p.id), {
            profileId: trimmed,
          }),
        ),
      );
    }
    setActiveProfile(trimmed);
  };

  const copyProfile = async () => {
    if (profiles.length >= PIN_LIMITS.maxProfilesPerRoom) {
      alert(`プロフィールは最大 ${PIN_LIMITS.maxProfilesPerRoom} 件までです。`);
      return;
    }
    const base = activeProfile || 'default';
    let suffix = 1;
    let candidate = `${base}_copy`;
    while (profiles.includes(candidate)) {
      suffix += 1;
      candidate = `${base}_copy${suffix}`;
    }
    const sourcePins = (activeMode === 'shared' ? sharedPins : localPins).filter(
      (p) => (p.profileId || 'default') === base && p.mapId === currentMap,
    );
    addProfile(candidate);
    if (activeMode === 'local') {
      const copied = sourcePins.map((p) => ({
        ...p,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profileId: candidate,
        createdAt: new Date(),
        roomId: roomId || 'local',
        expiresAt: new Date(Date.now() + PIN_LIMITS.pinTtlMs),
      }));
      setLocalPins((prev) => [...prev, ...copied]);
    } else {
      sourcePins.forEach((p) => {
        addDoc(collection(db, 'artifacts', appId, 'public', 'data', `${roomId}_pins`), {
          ...p,
          id: undefined,
          createdAt: serverTimestamp(),
          expiresAt: ttlTimestamp(PIN_LIMITS.pinTtlMs),
          roomId,
          profileId: candidate,
          note: p.note || '',
        });
      });
    }
    setActiveProfile(candidate);
  };

  const deleteCurrentProfile = async () => {
    if (profiles.length <= 1) return;
    const target = activeProfile;
    const nextList = profiles.filter((p) => p !== target);
    setMapMetaForMode(currentMap, (prev) => {
      const meta = prev[currentMap] || {};
      return { ...prev, [currentMap]: { ...meta, profiles: nextList } };
    });
    updateMapMeta(currentMap, { profiles: nextList });
    setActiveProfile(nextList[0] || 'default');
    if (activeMode === 'local') {
      setLocalPins((prev) =>
        prev.filter(
          (p) => !(p.mapId === currentMap && (p.profileId || 'default') === target),
        ),
      );
    } else {
      const toDelete = sharedPins.filter(
        (p) => p.mapId === currentMap && (p.profileId || 'default') === target,
      );
      const collectionName = `${roomId}_pins`;
      await Promise.allSettled(
        toDelete.map((p) =>
          deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, p.id)),
        ),
      );
    }
  };

  const config = MAP_CONFIG[currentMap];
  let defaultUrl = config.defaultUrl;
  let imageKey = currentMap;
  if (config.layers && currentLayer) {
    const layerObj = config.layers.find((l) => l.id === currentLayer);
    if (layerObj) defaultUrl = layerObj.defaultUrl;
    imageKey = `${currentMap}_${currentLayer}`;
  }
  const displayUrl = localImages[imageKey] || defaultUrl;
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [currentMap, currentLayer, localImages]);

  const applyRoomId = (nextRoomId, opts = {}) => {
    const { creator = false } = opts;
    setRoomId(nextRoomId);
    setRoomMode(nextRoomId ? 'shared' : 'local');
    setRoomCreator(Boolean(nextRoomId) && creator);
    setRoomInput(nextRoomId || '');
    try {
      if (nextRoomId) {
        localStorage.setItem(LAST_SHARED_ROOM_KEY, nextRoomId);
        addRoomToHistory(nextRoomId, creator ? 'owner' : 'member');
      }
    } catch {}
    setSelectedPinId(null);
    if (!nextRoomId) {
      setSharedPins([]);
      setSharedMapMeta({});
      setRoomInfo(null);
    }
    const params = new URLSearchParams(window.location.search);
    if (nextRoomId) params.set('room', nextRoomId);
    else params.delete('room');
    params.set('map', currentMap);
    params.set('profile', activeProfile);
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  };

  const copyRoomLink = () => {
    const activeRoomId = roomId || generateRoomId();
    if (!roomId) {
      const ownerRoomsCount = savedRooms.filter((r) => r.role === 'owner').length;
      if (ownerRoomsCount >= MAX_OWNER_ROOMS) {
        alert(`オーナーとして保持できるルームは最大 ${MAX_OWNER_ROOMS} 件です。不要なルームを削除してください。`);
        return;
      }
      applyRoomId(activeRoomId, { creator: true });
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      })
      .catch(() => alert('Room ID: ' + activeRoomId));
  };

  const takeScreenshot = async () => {
    try {
      if (!mapWrapperRef.current) {
        alert('マップが見つかりません');
        return;
      }

      const wrapper = mapWrapperRef.current;
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        allowTaint: true,
        useCORS: true,
        logging: false,
      });

      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let foundNonBlack = false;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 20 || g > 20 || b > 20) {
          const pixelIndex = i / 4;
          const x = pixelIndex % canvas.width;
          const y = Math.floor(pixelIndex / canvas.width);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          foundNonBlack = true;
        }
      }

      const padding = 20;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(canvas.width - cropX, maxX - minX + padding * 2);
      const cropHeight = Math.min(canvas.height - cropY, maxY - minY + padding * 2);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;

      const croppedCtx = croppedCanvas.getContext('2d');
      if (foundNonBlack && cropWidth > 0 && cropHeight > 0) {
        croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      } else {
        croppedCtx.drawImage(canvas, 0, 0);
      }

      croppedCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const mapName = MAP_CONFIG[currentMap]?.name || 'map';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `${mapName}_${timestamp}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('スクリーンショット取得失敗:', error);
      alert('スクリーンショットの保存に失敗しました');
    }
  };

  const approvePending = async (entry) => {
    if (!isOwner || !roomDocRef) return;
    try {
      setActionMessage('許可中...');
      await updateDoc(roomDocRef, {
        allowedUsers: arrayUnion(entry.uid),
        pending: arrayRemove(entry),
      });
      setActionMessage(`許可しました: ${entry.name || entry.uid}`);
    } catch (err) {
      console.error('Approve failed', err);
      setActionMessage('許可に失敗しました');
    } finally {
      setTimeout(() => setActionMessage(''), 2000);
    }
  };

  const rejectPending = async (entry) => {
    if (!isOwner || !roomDocRef) return;
    try {
      setActionMessage('拒否中...');
      await updateDoc(roomDocRef, {
        pending: arrayRemove(entry),
      });
      setActionMessage(`拒否しました: ${entry.name || entry.uid}`);
    } catch (err) {
      console.error('Reject failed', err);
      setActionMessage('拒否に失敗しました');
    } finally {
      setTimeout(() => setActionMessage(''), 2000);
    }
  };

  const handleSelectLocal = () => {
    setShowSharedSetup(false);
    applyRoomId(null);
    setModeChosen(true);
    setModeError('');
  };

  const handleOpenSharedSetup = () => {
    if (!displayName.trim()) {
      setModeError('記載者名を入力してください');
      return;
    }
    setModeError('');
    setRoomMode('shared');
    if (!roomInput && lastSharedRoom) setRoomInput(lastSharedRoom);
    setShowSharedSetup(true);
  };

  const handleConfirmShared = () => {
    const target = roomInput.trim() || generateRoomId();
    const ownerRoomsCount = savedRooms.filter((r) => r.role === 'owner').length;
    const isExistingOwner = savedRooms.some((r) => r.id === target && r.role === 'owner');
    if (!isExistingOwner && ownerRoomsCount >= MAX_OWNER_ROOMS) {
      setModeError(`オーナーとして保持できるルームは最大 ${MAX_OWNER_ROOMS} 件です。不要なルームを削除してください。`);
      return;
    }
    applyRoomId(target, { creator: true });
    setRoomCreator(true);
    setModeChosen(true);
    setShowSharedSetup(false);
  };

  const handleCancelShared = () => {
    setShowSharedSetup(false);
    setRoomMode('local');
  };

  // Mode Selection Screen
  if (!modeChosen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200 text-gray-900 flex items-center justify-center p-4 sm:p-6 relative">
        <div className="max-w-5xl w-full space-y-6 sm:space-y-8 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">モード選択</div>
            <div className="text-xs sm:text-sm text-gray-500">アプリケーションの実行環境を選択してください</div>
          </div>
          <div className="max-w-md mx-auto space-y-2 text-left">
            <label className="text-xs text-gray-600">記載者名</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
              placeholder="名前を入力"
              className={`w-full bg-white border ${modeError ? 'border-red-500' : 'border-gray-400'} rounded px-3 py-2.5 text-sm text-gray-900`}
            />
            {modeError && <div className="text-xs text-red-500">{modeError}</div>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <button
              onClick={handleSelectLocal}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-400 hover:border-gray-700 transition shadow flex flex-col items-center gap-3"
            >
              <div className="p-3 sm:p-4 rounded-full bg-gray-200 text-gray-700">
                <User size={isMobile ? 24 : 32} />
              </div>
              <div className="text-lg sm:text-xl font-bold">ローカル</div>
              <div className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                自分の端末内だけで完結します。通信を行わず、個人的に使用する場合に最適です。
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-gray-600"></span> オフライン動作
              </div>
            </button>
            <button
              onClick={handleOpenSharedSetup}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-400 hover:border-gray-700 transition shadow flex flex-col items-center gap-3"
            >
              <div className="p-3 sm:p-4 rounded-full bg-gray-200 text-gray-700">
                <Users size={isMobile ? 24 : 32} />
              </div>
              <div className="text-lg sm:text-xl font-bold">共有（オンライン）</div>
              <div className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                データをクラウドで同期します。チームや友人と情報を共有する場合に最適です。
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-gray-600"></span> インターネット接続が必要
              </div>
            </button>
          </div>
        </div>
        {showSharedSetup && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-300 rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-5 space-y-3 text-gray-900">
              <div className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Users size={18} /> 共有ルームに参加 / 発行
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                ルームIDを入力するか、発行ボタンで新しいIDを生成してください。
              </div>
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="w-full bg-white border border-gray-400 rounded px-3 py-2.5 text-sm"
                placeholder="ルームIDを入力"
              />
              {savedRooms.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="text-xs text-gray-600">保存したルーム一覧</div>
                  {savedRooms
                    .filter((r) => r.role === 'owner')
                    .map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <span className="text-[11px] text-orange-600">owner</span>
                        <button
                          onClick={() => setRoomInput(r.id)}
                          className="flex-1 text-left px-2 py-1 rounded border border-gray-300 hover:border-gray-500"
                        >
                          {r.id}
                        </button>
                        <button
                          onClick={() => removeRoomFromHistory(r.id)}
                          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  {savedRooms.filter((r) => r.role !== 'owner').length > 0 && (
                    <div className="border-t border-gray-200 pt-2 space-y-1">
                      {savedRooms
                        .filter((r) => r.role !== 'owner')
                        .map((r) => (
                          <div key={r.id} className="flex items-center gap-2 text-sm">
                            <span className="text-[11px] text-gray-500">member</span>
                            <button
                              onClick={() => setRoomInput(r.id)}
                              className="flex-1 text-left px-2 py-1 rounded border border-gray-300 hover:border-gray-500"
                            >
                              {r.id}
                            </button>
                            <button
                              onClick={() => removeRoomFromHistory(r.id)}
                              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setRoomInput(generateRoomId())}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm text-white py-2.5 rounded"
                >
                  ルームID発行
                </button>
                <button
                  onClick={() => {
                    if (lastSharedRoom) setRoomInput(lastSharedRoom);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-sm text-gray-900 py-2.5 rounded disabled:opacity-40"
                  disabled={!lastSharedRoom}
                >
                  前回のIDを使う
                </button>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={handleCancelShared}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmShared}
                  className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded text-white font-semibold"
                >
                  開始する
                </button>
              </div>

              {activeMode === 'shared' && isOwner && roomId && (
                <div className="mt-4 space-y-2 border-t border-gray-800 pt-3">
                  <div className="text-xs text-gray-400">このルームのピンを一括削除</div>
                  <button
                    onClick={deleteAllRoomPins}
                    disabled={isDeletingPins}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow disabled:opacity-50"
                  >
                    {isDeletingPins ? '削除中...' : 'ピンをすべて削除'}
                  </button>
                  <div className="text-[11px] text-gray-500">
                    オーナーだけが実行できます。削除は取り消せないのでご注意ください。
                  </div>
                  <div className="text-xs text-gray-400 pt-1">タイプを選んで削除</div>
                  <select
                    value={deleteTargetType}
                    onChange={(e) => setDeleteTargetType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="">タイプを選択</option>
                    {Object.values(mergedMarkers).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={deletePinsByType}
                    disabled={isDeletingPins || !deleteTargetType}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded bg-red-700 hover:bg-red-600 text-white border border-red-600 shadow disabled:opacity-50"
                  >
                    {isDeletingPins ? '削除中...' : '選んだタイプのピンを削除'}
                  </button>
                  <div className="text-[11px] text-gray-500">
                    選択したタイプのピンだけを削除します。確認のうえ実行してください。
                  </div>
                  <div className="text-xs text-gray-400 pt-1">ルームまるごと削除</div>
                  <button
                    onClick={deleteCurrentRoomData}
                    disabled={isDeletingPins}
                    className="w-full px-3 py-2.5 text-sm font-semibold rounded bg-red-800 hover:bg-red-700 text-white border border-red-700 shadow disabled:opacity-50"
                  >
                    {isDeletingPins ? '削除中...' : 'ルームとデータを削除'}
                  </button>
                  <div className="text-[11px] text-gray-500">
                    ピン/マップメタ/ルーム情報を削除し、履歴からも外します。元に戻せません。
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    );
  }

  // Main App UI
  return (
    <div className="flex flex-col h-screen bg-black text-gray-200 overflow-hidden font-sans relative touch-none">
      {actionMessage && (
        <div className="absolute top-14 left-2 z-50 bg-blue-900/80 text-xs px-3 py-2 rounded shadow">
          {actionMessage}
        </div>
      )}
      
      {isOwner && normalizedPending.length > 0 && (
        <div className={`absolute z-50 bg-slate-800/90 border border-slate-600 rounded-lg shadow-lg p-3 ${isMobile ? 'top-14 left-2 right-2' : 'top-14 right-2 w-72'}`}>
          <div className="text-sm font-bold mb-2">承認待ち ({normalizedPending.length})</div>
          <div className="space-y-2 max-h-40 sm:max-h-60 overflow-auto">
            {normalizedPending.map((p) => (
              <div key={p.uid} className="flex items-center justify-between bg-slate-900/80 px-2 py-1 rounded">
                <div className="text-xs">
                  <div className="font-semibold text-gray-100">{p.name || p.uid}</div>
                  <div className="text-[10px] text-gray-400 break-all">{p.uid}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => approvePending(p)}
                    className="text-[10px] bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                  >
                    許可
                  </button>
                  <button
                    onClick={() => rejectPending(p)}
                    className="text-[10px] bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded"
                  >
                    拒否
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeMode === 'shared' && !isOwner && !isApproved && (
        <div className="absolute inset-0 z-40 bg-black/70 flex flex-col items-center justify-center text-center px-6">
          <div className="text-lg sm:text-xl font-bold mb-2">オーナーの承認が必要です</div>
          <div className="text-xs sm:text-sm text-gray-300 mb-4">
            {approvalMessage || '承認されるまで操作できません。しばらくお待ちください。'}
          </div>
          <button
            onClick={() => applyRoomId(null)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded shadow"
          >
            ローカルに戻る
          </button>
        </div>
      )}
      
      {!useFirebase && (
        <div className="absolute top-14 right-2 z-50 bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded shadow">
          Firebase disabled
        </div>
      )}
      
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
      <input type="file" ref={iconFileInputRef} className="hidden" accept="image/*" onChange={handleIconFileSelect} />
      <input type="file" ref={newMarkerIconInputRef} className="hidden" accept="image/*" onChange={handleNewMarkerUpload} />

      {/* Header */}
      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-2 sm:px-4 z-30 shadow-lg shrink-0">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white md:hidden"
          >
            <Menu size={20} />
          </button>
          
          <ShieldAlert className="text-orange-500 w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          <h1 className="font-bold text-sm sm:text-base tracking-wider text-gray-100 hidden sm:block">TACTICAL</h1>
          
          {/* Desktop: Mode Selection Button */}
          <button
            onClick={() => {
              setModeChosen(false);
              setRoomMode("local");
              setRoomId(null);
              setRoomInput(lastSharedRoom || "");
            }}
            className="hidden xl:flex bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-bold transition-all shadow-md items-center gap-1"
          >
            <Home size={12} />
            モード選択
          </button>
        </div>

        {/* Center Section - Map/Profile Selectors (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 flex-1 justify-center max-w-4xl mx-4">
          <select
            value={currentMap}
            onChange={(e) => setCurrentMap(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          >
            {Object.values(MAP_CONFIG).map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
          
          <select
            value={activeProfile}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          >
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="新規プロファイル"
            className="w-28 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          />
          <button
            onClick={() => {
              addProfile(newProfileName || `攻略${profiles.length + 1}`);
              setNewProfileName('');
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            追加
          </button>

          <input
            value={renameProfileName}
            onChange={(e) => setRenameProfileName(e.target.value)}
            placeholder="リネーム"
            className="w-24 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          />
          <button
            onClick={() => {
              renameProfile(renameProfileName);
              setRenameProfileName('');
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            リネーム
          </button>
          <button
            onClick={copyProfile}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            コピー
          </button>
          <button
            onClick={deleteCurrentProfile}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
          >
            削除
          </button>
          
          <button
            onClick={() => setSelectedTool(selectedTool === 'custom_pin' ? 'move' : 'custom_pin')}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded border transition-all ${
              selectedTool === 'custom_pin'
                ? 'bg-orange-600 text-white border-orange-400'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
            }`}
          >
            <MapPin size={14} />
            Drop Pin
          </button>
        </div>

        {/* Mobile/Tablet Center Controls */}
        <div className="flex lg:hidden items-center gap-1 flex-1 justify-center mx-2">
          <select
            value={currentMap}
            onChange={(e) => setCurrentMap(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 max-w-[90px]"
          >
            {Object.values(MAP_CONFIG).map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
          
          <select
            value={activeProfile}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 max-w-[70px]"
          >
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSelectedTool(selectedTool === 'custom_pin' ? 'move' : 'custom_pin')}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-bold rounded border transition-all ${
              selectedTool === 'custom_pin'
                ? 'bg-orange-600 text-white border-orange-400'
                : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
          >
            <MapPin size={14} />
          </button>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Desktop Controls */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1 border border-gray-700">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
                placeholder="記載者名"
                className="bg-transparent text-sm text-white outline-none w-24"
              />
            </div>
            <button
              onClick={copyRoomLink}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1"
            >
              <Share2 size={14} />
              共有
            </button>
            <button
              onClick={takeScreenshot}
              className="bg-green-600 hover:bg-green-500 text-white px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1"
            >
              <Download size={14} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white md:hidden"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Layer Selector */}
      {config.layers && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex gap-1 sm:gap-2 bg-black/80 backdrop-blur p-1 rounded-lg border border-gray-700">
          {config.layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setCurrentLayer(layer.id)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 text-xs font-bold rounded transition-all ${
                currentLayer === layer.id ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Layers size={12} />
              <span className="hidden sm:inline">{layer.name}</span>
              <span className="sm:hidden">{layer.id === 'upper' ? '地上' : '地下'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 relative flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-64 bg-gray-900/95 backdrop-blur border-r border-gray-800 flex-col z-20 shadow-xl shrink-0 overflow-hidden">
          <div className="p-3 border-b border-gray-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-gray-700 rounded pl-8 pr-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            {/* Room ID Section */}
            <div className="flex items-center gap-2">
              <div className="w-20 bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 flex items-center justify-center font-bold">
                {roomMode === "local" ? "ローカル" : "共有"}
              </div>
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="ROOM ID"
                disabled={roomMode === "local" || (roomMode === "shared" && modeChosen)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 disabled:opacity-50"
              />
              <button
                onClick={() => {
                  if (roomMode === "local") {
                    applyRoomId(null);
                    setModeChosen(true);
                    return;
                  }
                  setShowSharedSetup(true);
                }}
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded hover:bg-gray-700 disabled:opacity-50"
                disabled={roomMode === "local"}
              >
                接続
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTool('move')}
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-bold transition-colors border ${
                  selectedTool === 'move'
                    ? 'bg-gray-700 text-white border-gray-500'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                }`}
              >
                <Move size={14} />
                移動
              </button>
              <button
                onClick={triggerFileUpload}
                className="px-3 py-1.5 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500"
              >
                <ImageIcon size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={showAllMarkers}
                className="flex-1 py-1.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-xs font-bold"
              >
                全て表示
              </button>
              <button
                onClick={hideAllMarkers}
                className="flex-1 py-1.5 rounded bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 text-xs font-bold"
              >
                全て非表示
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
            {Object.entries(MARKER_CATEGORIES).map(([catKey, category]) => (
              <div key={catKey} className="rounded overflow-hidden">
                <div className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 text-xs font-bold text-gray-300">
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-white"
                  >
                    <span>{category.label}</span>
                    {openCategories[catKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <button
                    onClick={() => startAddCustomMarker(catKey)}
                    className="p-1 rounded hover:bg-gray-700 text-gray-300 hover:text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {openCategories[catKey] && (
                  <div className="bg-black/20 p-1 space-y-0.5">
                    {Object.values(mergedMarkers)
                      .filter((m) => m.cat === catKey)
                      .filter((m) => m.label.includes(searchTerm))
                      .map((marker) => {
                        const MarkerIcon = marker.icon;
                        const isActive = selectedTool === marker.id;
                        const iconImage = markerIcons[marker.id];
                        const count = markerCounts[marker.id] || 0;
                        const visible = isMarkerVisible(marker.id);
                        return (
                          <div
                            key={marker.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTool(marker.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedTool(marker.id);
                              }
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all cursor-pointer ${
                              isActive
                                ? 'bg-gray-700 text-white ring-1 ring-inset ring-gray-500'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                          >
                            {iconImage ? (
                              <img src={iconImage} alt="" className="w-5 h-5 rounded-full object-cover border border-gray-600/60" />
                            ) : (
                              <MarkerIcon size={16} color={category.color} />
                            )}
                            <span className="flex-1 text-left truncate">{marker.label}</span>
                            <span className="text-[11px] text-gray-400">{count}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerIconUpload(marker.id);
                                }}
                                className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                                title="アイコン変更"
                              >
                                <Camera size={10} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMarkerVisibility((prev) => ({ ...prev, [marker.id]: !visible }));
                                }}
                                className={`p-1 rounded border ${
                                  visible ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-900 text-gray-500 border-gray-800'
                                }`}
                              >
                                <EyeOff size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-800 text-[10px] text-gray-600 text-center">
            Room: {roomId || 'ローカル'}
          </div>
        </div>

        {/* Mobile Sidebar */}
        <MobileSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          openCategories={openCategories}
          toggleCategory={toggleCategory}
          mergedMarkers={mergedMarkers}
          markerIcons={markerIcons}
          markerCounts={markerCounts}
          isMarkerVisible={isMarkerVisible}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          setMarkerVisibility={setMarkerVisibility}
          triggerIconUpload={triggerIconUpload}
          showAllMarkers={showAllMarkers}
          hideAllMarkers={hideAllMarkers}
          startAddCustomMarker={startAddCustomMarker}
          roomId={roomId}
          roomMode={roomMode}
          roomInput={roomInput}
          setRoomInput={setRoomInput}
          modeChosen={modeChosen}
          applyRoomId={applyRoomId}
          setShowSharedSetup={setShowSharedSetup}
          triggerFileUpload={triggerFileUpload}
        />

        {/* Mobile Header Menu */}
        <MobileHeaderMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          currentMap={currentMap}
          setCurrentMap={setCurrentMap}
          activeProfile={activeProfile}
          setActiveProfile={setActiveProfile}
          profiles={profiles}
          addProfile={addProfile}
          renameProfile={renameProfile}
          copyProfile={copyProfile}
          deleteProfile={deleteCurrentProfile}
          displayName={displayName}
          setDisplayName={setDisplayName}
          copyRoomLink={copyRoomLink}
          takeScreenshot={takeScreenshot}
          setModeChosen={setModeChosen}
          roomId={roomId}
          setRoomId={setRoomId}
          setRoomMode={setRoomMode}
          setRoomInput={setRoomInput}
          lastSharedRoom={lastSharedRoom}
        />

        {/* Map Area */}
        <div
          ref={mapWrapperRef}
          className={`flex-1 relative overflow-hidden bg-black ${selectedTool === 'move' ? 'cursor-grab' : 'cursor-crosshair'} ${isDragging ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={mapRef}
            className="absolute origin-top-left will-change-transform"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              width: config.width,
              height: config.height,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            onClick={handleMapClick}
          >
            {!imgError && displayUrl ? (
              <img
                src={displayUrl}
                alt={config.name}
                className="w-full h-full object-fill pointer-events-none select-none"
                draggable={false}
                onError={() => setImgError(true)}
              />
            ) : (
              <TacticalGrid config={config} onUpload={triggerFileUpload} />
            )}

            {visiblePins.map((pin) => {
              const markerDef = mergedMarkers[pin.type] || FALLBACK_MARKER;
              const category = MARKER_CATEGORIES[markerDef.cat] || MARKER_CATEGORIES.others;
              const PinIcon = markerDef.icon;
              const isSelected = pin.id === selectedPinId;
              const isMarked = markedPinIds.includes(pin.id);
              const iconImage = pin.iconUrl || markerIcons[pin.type];

              const baseScale = Math.max(0.3, iconBaseScale);
              const scale = baseScale;
              const opacity = selectedPinId && !isSelected ? 0.4 : 1;
              const zIndex = isSelected ? 50 : 10;

              return (
                <div
                  key={pin.id}
                  className="pin-element absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200"
                  style={{
                    left: pin.x,
                    top: pin.y,
                    transform: `scale(${scale})`,
                    opacity,
                    zIndex,
                  }}
                  onClick={(e) => handlePinClick(e, pin.id)}
                >
                  <div className="relative flex flex-col items-center group">
                    <div
                      className={`drop-shadow-md filter transition-all ${
                        isSelected ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : ''
                      }`}
                    >
                      <div className="absolute inset-[-6px] rounded-full border-2 border-orange-500 opacity-80 pointer-events-none" />
                      {isMarked && (
                        <Heart size={16} color="#f87171" fill="#f87171" className="absolute -top-2 -right-2 drop-shadow-md pointer-events-none" />
                      )}
                      {iconImage ? (
                        <img src={iconImage} alt="Pin" className="w-8 h-8 rounded-full border border-black/40 object-cover" />
                      ) : (
                        <PinIcon size={24} fill={category.color} color="#000000" strokeWidth={1.5} className={isSelected ? 'text-white' : ''} />
                      )}
                    </div>
                    {!isSelected && !isMobile && (
                      <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none border border-white/20 z-50">
                        {markerDef.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pin Popup */}
          {selectedPinId && (() => {
            const pin = pins.find((p) => p.id === selectedPinId);
            if (!pin) return null;
            const markerDef = mergedMarkers[pin.type] || FALLBACK_MARKER;
            return (
              <PinPopup
                pin={pin}
                markerDef={markerDef}
                isMobile={isMobile}
                onClose={() => setSelectedPinId(null)}
                onUpdateImage={updatePinImage}
                onUpdateNote={updatePinNote}
                onMark={(id) => {
                  setMarkedPinIds((prev) => prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]);
                  setSelectedPinId(id);
                }}
                onDelete={deletePin}
              />
            );
          })()}

          {/* Floating Controls */}
          <div className={`absolute z-10 pointer-events-none ${isMobile ? 'bottom-4 right-2 left-2' : 'bottom-4 right-4'}`}>
            <div className={`flex ${isMobile ? 'justify-between' : 'items-end gap-3 justify-end'}`}>
              {/* Icon Scale Slider */}
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2 border border-gray-700/50 shadow pointer-events-auto">
                <Scaling size={14} className="text-gray-400" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={iconBaseScale}
                  onChange={(e) => setIconBaseScale(parseFloat(e.target.value))}
                  className="w-16 sm:w-28 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {isMobile ? (
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 border border-gray-700/50">
                    <button
                      onClick={() => setZoom(transform.scale - 0.2)}
                      className="p-2 text-gray-300 hover:text-white"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <span className="text-xs text-gray-400 w-12 text-center">{Math.round(transform.scale * 100)}%</span>
                    <button
                      onClick={() => setZoom(transform.scale + 0.2)}
                      className="p-2 text-gray-300 hover:text-white"
                    >
                      <ZoomIn size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative h-32 sm:h-40 w-10 sm:w-12 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full border border-gray-700/50 shadow">
                      <div className="-rotate-90 w-24 sm:w-28">
                        <input
                          type="range"
                          min="0.2"
                          max="5"
                          step="0.1"
                          value={transform.scale}
                          onChange={(e) => setZoom(parseFloat(e.target.value))}
                          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-2 rounded-full shadow-lg border border-gray-700"
                    >
                      <Settings size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Settings Button */}
          {isMobile && (
            <button
              onClick={() => setShowSettings(true)}
              className="absolute bottom-20 right-2 z-10 bg-gray-800 hover:bg-gray-700 text-gray-200 p-2.5 rounded-full shadow-lg border border-gray-700"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow-xl z-50 animate-bounce pointer-events-none text-sm">
          リンクをコピーしました
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-4 sm:p-5 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-gray-400">初期アイコンに戻すピン種類</div>
              <select
                value={resetTargetId}
                onChange={(e) => setResetTargetId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                {Object.values(mergedMarkers).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => resetMarkerIcon(resetTargetId)}
                  disabled={!resetTargetId || isResettingIcon}
                  className="flex-1 px-3 py-2.5 text-sm font-semibold rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 shadow disabled:opacity-50"
                >
                  アイコン初期化
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-3 py-2.5 text-sm font-semibold rounded bg-orange-600 hover:bg-orange-500 text-white"
                >
                  閉じる
                </button>
              </div>
            </div>

            {activeMode === 'shared' && isOwner && roomId && (
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-3">
                <div className="text-xs text-gray-400">このルームのピンを一括削除</div>
                <button
                  onClick={deleteAllRoomPins}
                  disabled={isDeletingPins}
                  className="w-full px-3 py-2.5 text-sm font-semibold rounded bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow disabled:opacity-50"
                >
                  {isDeletingPins ? '削除中...' : 'ピンをすべて削除'}
                </button>
                <div className="text-[11px] text-gray-500">
                  オーナーだけが実行できます。削除は取り消せないのでご注意ください。
                </div>
                <div className="text-xs text-gray-400 pt-1">タイプを選んで削除</div>
                <select
                  value={deleteTargetType}
                  onChange={(e) => setDeleteTargetType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="">タイプを選択</option>
                  {Object.values(mergedMarkers).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={deletePinsByType}
                  disabled={isDeletingPins || !deleteTargetType}
                  className="w-full px-3 py-2.5 text-sm font-semibold rounded bg-red-700 hover:bg-red-600 text-white border border-red-600 shadow disabled:opacity-50"
                >
                  {isDeletingPins ? '削除中...' : '選んだタイプのピンを削除'}
                </button>
                <div className="text-[11px] text-gray-500">
                  選択したタイプのピンだけを削除します。確認のうえ実行してください。
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Marker Dialog */}
      {showMarkerDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-4 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">新しいピンを追加</h3>
              <button onClick={() => setShowMarkerDialog(false)} className="text-gray-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <div className="text-xs text-gray-400">カテゴリ: {newMarkerCat && MARKER_CATEGORIES[newMarkerCat]?.label}</div>
            <input
              value={newMarkerName}
              onChange={(e) => setNewMarkerName(e.target.value)}
              placeholder="ピン名を入力"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm text-white focus:border-orange-500 outline-none"
            />

            <div>
              <div className="text-xs text-gray-400 mb-2">アイコンを選択</div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {availableIcons.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => setNewMarkerIcon(icon.dataUrl)}
                    className={`h-12 rounded-lg border ${
                      newMarkerIcon === icon.dataUrl ? 'border-orange-500 ring-1 ring-orange-400' : 'border-gray-700'
                    } bg-gray-800 flex items-center justify-center hover:border-gray-500`}
                  >
                    <img src={icon.dataUrl} alt={icon.label} className="w-8 h-8 rounded" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center overflow-hidden">
                  {newMarkerIcon ? (
                    <img src={newMarkerIcon} alt="選択中アイコン" className="w-full h-full object-cover" />
                  ) : (
                    <MapPin size={20} className="text-gray-500" />
                  )}
                </div>
                <button
                  onClick={() => newMarkerIconInputRef.current?.click()}
                  className="px-3 py-2 text-xs font-semibold rounded border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Upload size={14} />
                  画像をアップロード
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMarkerDialog(false)}
                className="px-4 py-2.5 text-sm rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={confirmAddCustomMarker}
                className="px-4 py-2.5 text-sm rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
