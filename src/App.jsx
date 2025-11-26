import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';

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

const firebaseEnabled = Boolean(parsedConfig && parsedConfig.apiKey);
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
    app = initializeApp(parsedConfig);
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
    : 'default-app';

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
    <div className="text-center p-6 bg-black/50 backdrop-blur rounded-xl border border-gray-700">
      <ImageIcon size={48} className="mx-auto text-gray-500 mb-4" />
      <p className="text-gray-300 font-bold mb-2">NO MAP IMAGE</p>
      <p className="text-gray-500 text-sm mb-4 max-w-xs">
        セキュリティ制限のため、画像はローカルから選択してください。
      </p>
      <button
        onClick={onUpload}
        className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded flex items-center gap-2 mx-auto transition-colors"
      >
        <Upload size={16} />
        マップ画像を選択
      </button>
    </div>
  </div>
);

const PinPopup = ({ pin, markerDef, onClose, onUpdateImage, onUpdateIcon, onUpdateNote, onDelete, onMark }) => {
  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const categoryDef = MARKER_CATEGORIES[markerDef.cat] || MARKER_CATEGORIES.others;
  const [noteDraft, setNoteDraft] = useState(pin.note || '');

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressImage(file);
      onUpdateImage(pin.id, compressedBase64);
    } catch (err) {
      console.error('Image upload failed', err);
      alert('画像の処理に失敗しました');
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !onUpdateIcon) return;
    try {
      const compressedBase64 = await compressImage(file, 128);
      onUpdateIcon(pin.id, compressedBase64);
    } catch (err) {
      console.error('Icon upload failed', err);
      alert('アイコンの処理に失敗しました');
    }
  };

  return (
    <div
      className="absolute z-[100] bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 w-72 overflow-hidden"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative h-40 bg-gray-800 flex items-center justify-center overflow-hidden group">
        {pin.imageUrl ? (
          <img src={pin.imageUrl} alt="Pin Attachment" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <Camera size={32} className="mb-2 opacity-50" />
            <span className="text-xs">No Image</span>
          </div>
        )}

        <div
          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-center">
            <Upload className="mx-auto mb-1 text-white" size={24} />
            <span className="text-xs font-bold text-white">画像を追加/変更</span>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <input
          type="file"
          ref={iconInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleIconUpload}
        />
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase mb-0.5">
              <markerDef.icon size={12} color={categoryDef.color} />
              {categoryDef.label}
            </div>
            <h3 className="text-lg font-bold leading-tight">{markerDef.label}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

                <div className="text-xs text-gray-500 mb-4">投稿者: <span className="text-gray-300 font-semibold">{pin.createdByName || '不明'}</span> <span className="ml-2 text-gray-600">ID: {pin.id.slice(0, 6)}…</span></div>
                <div className="flex flex-col gap-2 mb-3">
                  <label className="text-[10px] text-gray-400">メモ</label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="w-full h-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                    placeholder="ピンに紐づくメモを入力"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => onUpdateNote?.(pin.id, noteDraft)}
                      className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200"
                    >
                      保存
                    </button>
                  </div>
                </div>

        <div className="flex gap-2 mb-2">
          <button
            onClick={() => iconInputRef.current?.click()}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Camera size={14} />
            アイコン変更
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            画像添付
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onMark?.(pin.id)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2"
          >
            <MapPin size={14} />
            場所をマークする
          </button>

          <button
            onClick={() => onDelete(pin.id)}
            className="bg-red-900/50 hover:bg-red-900 text-red-200 p-2 rounded transition-colors"
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
  MAIN APP COMPONENT
  ========================================
*/
const LAST_SHARED_ROOM_KEY = 'tactical_last_shared_room';

export default function App() {
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showShareToast, setShowShareToast] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [roomMode, setRoomMode] = useState('local'); // local or shared
  const [roomInput, setRoomInput] = useState(lastSharedRoom || '');
  const [modeChosen, setModeChosen] = useState(false);
  const [showSharedSetup, setShowSharedSetup] = useState(false);
  const [roomCreator, setRoomCreator] = useState(false);
  const [activeProfile, setActiveProfile] = useState('default'); // マップ攻略プロファイルID
  const [newProfileName, setNewProfileName] = useState('');
  const [renameProfileName, setRenameProfileName] = useState('');
  const [localMapMeta, setLocalMapMeta] = useState({});
  const [sharedMapMeta, setSharedMapMeta] = useState({});
  const [roomInfo, setRoomInfo] = useState(null); // { ownerUid, allowedUsers, pending }
  const [roomInfoLoading, setRoomInfoLoading] = useState(false);
  const roomDocRef = useMemo(
    () => (db && roomId ? doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId) : null),
    [db, roomId],
  );
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
    // ローカルは常にOK
    if (activeMode !== 'shared') return true;
    // 共有だがまだ情報がない場合は、オーナー生成待ち
    if (!roomId) return false;
    if (!roomInfo) return roomCreator; // 生成中なら暫定許可、そうでなければブロック
    // ユーザー未確定でもブロックしない（匿名認証待ちの間も動けるように）
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
  }, [roomId, useFirebase, db, roomDocRef]);

  // Ensure room doc exists & owner is allowed
  useEffect(() => {
    const ensureRoom = async () => {
      if (!useFirebase || !roomId || !db || !user) return;
      try {
        if (!roomInfo) {
          if (!roomCreator) return; // 生成者でないなら作らない
          await setDoc(roomDocRef, {
            ownerUid: user.uid,
            allowedUsers: [user.uid],
            pending: [],
            createdAt: serverTimestamp(),
          });
          return;
        }
        // If owner is set, ensure owner is in allowedUsers
        if (roomInfo.ownerUid === user.uid) {
          if (!roomInfo.allowedUsers?.includes(user.uid)) {
            await updateDoc(roomDocRef, { allowedUsers: arrayUnion(user.uid) });
          }
        }
      } catch (err) {
        console.error('Ensure room failed', err);
      }
    };
    ensureRoom();
  }, [roomId, db, user, roomInfo, useFirebase]);

  // If visitor is not approved, add to pending
  useEffect(() => {
    const sendPending = async () => {
      if (!useFirebase || !roomId || !db || !user) return;
      if (!roomInfo) return; // wait until loaded
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
        }
      }
    };
    sendPending();
  }, [roomId, db, user, roomInfo, useFirebase, displayName]);

  useEffect(() => {
    const config = MAP_CONFIG[currentMap];
    if (config.layers && config.layers.length > 0) setCurrentLayer(config.layers[0].id);
    else setCurrentLayer(null);
    centerMap();
    // update URL map param
    const params = new URLSearchParams(window.location.search);
    params.set('map', currentMap);
    params.set('profile', activeProfile);
    if (roomId) params.set('room', roomId);
    else params.delete('room');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentMap, activeProfile, roomId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('map', currentMap);
    params.set('profile', activeProfile);
    if (roomId) params.set('room', roomId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeProfile]);

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
        const loadedPins = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSharedPins(loadedPins);
      },
      (error) => console.error(error),
    );
    return () => unsubscribe();
  }, [user, roomId]);

  useEffect(() => {
    if (!canSync || activeMode !== 'shared' || !auth || !db || !user) return;
    const collectionName = `${roomId}_mapmeta`;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded = {};
        snapshot.docs.forEach((docSnap) => {
          loaded[docSnap.id] = docSnap.data();
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


  const setZoom = (newScale, focal) => {
    const s = Math.min(Math.max(0.2, newScale), 5);
    const focalX = focal?.x ?? window.innerWidth / 2;
    const focalY = focal?.y ?? window.innerHeight / 2;

    // Zoom keeping the focal point (mouse position or center) stable
    const mapCenterX = (focalX - transform.x) / transform.scale;
    const mapCenterY = (focalY - transform.y) / transform.scale;

    const newX = focalX - mapCenterX * s;
    const newY = focalY - mapCenterY * s;

    setTransform({ x: newX, y: newY, scale: s });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
    const scaleSensitivity = 0.001;
    const newScale = transform.scale - e.deltaY * scaleSensitivity;
    setZoom(newScale, { x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });

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
    // ピン要素がクリックされた場合はスキップ
    if (e.target.closest('.pin-element')) return;

    if (isDragging) return;
    // 共有モードでユーザー/Room未接続ならサインインを試みて中断
    if (activeMode === 'shared' && (!user || !roomId)) {
      if (useFirebase && auth) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Auth retry failed', err);
        }
      }
      alert('共有モードでピンを置くにはRoom接続とサインインが必要です。数秒後に再度お試しください。');
      return;
    }

    if (selectedPinId) {
      setSelectedPinId(null);
      return;
    }

    if (selectedTool === 'move') return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / transform.scale;
    const y = (e.clientY - rect.top) / transform.scale;
    const config = MAP_CONFIG[currentMap];

    if (x < 0 || y < 0 || x > config.width || y > config.height) return;

    if (!canSync || activeMode === 'local') {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPinsForMode((prev) => [
        ...prev,
        {
          id: localId,
          mapId: currentMap,
          layerId: currentLayer,
          x,
          y,
          type: selectedTool,
          iconUrl: markerIcons[selectedTool] || undefined,
          profileId: activeProfile,
          note: '',
          createdAt: new Date(),
          createdBy: user?.uid || 'local',
          createdByName: displayName || '匿名',
        },
      ]);
      setSelectedPinId(localId);
      setSelectedTool('move');
      return;
    }

    if (!roomId) return;

    try {
      const collectionName = `${roomId}_pins`;
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), {
        mapId: currentMap,
        layerId: currentLayer,
        x,
        y,
        type: selectedTool,
        iconUrl: markerIcons[selectedTool] || undefined,
        profileId: activeProfile,
        note: '',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: displayName || '匿名',
      });
      setSelectedPinId(docRef.id);
      setSelectedTool('move');
    } catch (err) {
      console.error('Error adding pin:', err);
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

  const updatePinImage = async (pinId, base64Image) => {
    if (!user && activeMode === 'shared') return;
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.map((p) => (p.id === pinId ? { ...p, imageUrl: base64Image } : p)));
      return;
    }
    if (!roomId) return;
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        imageUrl: base64Image,
      });
    } catch (err) {
      console.error(err);
    }
  };
  const updatePinIcon = async (pinId, base64Icon) => {
    if (!user && activeMode === 'shared') return;
    addIconToLibrary(base64Icon);
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.map((p) => (p.id === pinId ? { ...p, iconUrl: base64Icon } : p)));
      return;
    }
    if (!roomId) return;
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        iconUrl: base64Icon,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updatePinNote = async (pinId, noteText) => {
    if (!user && activeMode === 'shared') return;
    if (!canSync || activeMode === 'local') {
      setPinsForMode((prev) => prev.map((p) => (p.id === pinId ? { ...p, note: noteText } : p)));
      return;
    }
    if (!roomId) return;
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        note: noteText,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const centerMap = () => {
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
    const config = MAP_CONFIG[currentMap];
    setTransform({
      x: containerW / 2 - (config.width * 0.4) / 2,
      y: containerH / 2 - (config.height * 0.4) / 2,
      scale: 0.4,
    });
  };

  const visiblePins = pins.filter((p) => {
    if (p.mapId !== currentMap) return false;
    const pinProfile = p.profileId || 'default';
    if (pinProfile !== activeProfile) return false;
    const config = MAP_CONFIG[currentMap];
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
  }, [currentMap, profiles]);
  const addProfile = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const list = Array.from(new Set([...profiles, trimmed]));
    // 即時にメタへ反映
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

  // Map metadata handling
  const updateMapMeta = async (mapId, partial) => {
    const prev = mapMeta[mapId] || {};
    const next = { ...prev, ...partial, updatedAt: Date.now(), updatedBy: user?.uid || 'local', updatedByName: displayName || 'ローカル' };
    if (activeMode === 'shared') {
      if (!canSync || !roomId || !user || !db) return;
      const collectionName = `${roomId}_mapmeta`;
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, mapId), next).catch(async (err) => {
          if (err.code === 'not-found' || String(err).includes('No document')) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, mapId), next);
          } else {
            throw err;
          }
        });
        setSharedMapMeta((prevMeta) => ({ ...prevMeta, [mapId]: next }));
      } catch (err) {
        console.error('Map meta update failed', err);
      }
    } else {
      setLocalMapMeta((prevMeta) => ({ ...prevMeta, [mapId]: next }));
    }
  };

  const copyRoomLink = () => {
    const activeRoomId = roomId || generateRoomId();
    if (!roomId) {
      applyRoomId(activeRoomId);
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
      const rect = wrapper.getBoundingClientRect();

      // 可視領域のサイズを取得
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);

      if (width === 0 || height === 0) {
        alert('マップが見つかりません');
        return;
      }

      // マップコンテナをCanvasに変換
      const canvas = await html2canvas(wrapper, {
        scale: 2, // 高解像度でキャプチャ
        allowTaint: true,
        useCORS: true,
        logging: false,
      });

      // 黒い領域を自動的に検出してトリミング
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let foundNonBlack = false;

      // 非黒色ピクセルの範囲を検出
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 黒色以外（ある程度の輝度）のピクセルを検出
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

      // トリミング領域を計算（パディング追加）
      const padding = 20;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(canvas.width - cropX, maxX - minX + padding * 2);
      const cropHeight = Math.min(canvas.height - cropY, maxY - minY + padding * 2);

      // トリミング後のCanvasを作成
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;

      const croppedCtx = croppedCanvas.getContext('2d');
      if (foundNonBlack && cropWidth > 0 && cropHeight > 0) {
        croppedCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );
      } else {
        // 非黒色が見つからない場合は元のキャンバスを使用
        croppedCtx.drawImage(canvas, 0, 0);
      }

      // CanvasをBlobに変換
      croppedCanvas.toBlob((blob) => {
        // ダウンロードリンクを作成
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // ファイル名を生成（マップ名 + タイムスタンプ）
        const mapName = MAP_CONFIG[currentMap]?.name || 'map';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `${mapName}_${timestamp}.png`;

        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // メモリ解放
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
  };

  const handleOpenSharedSetup = () => {
    setRoomMode('shared');
    if (!roomInput && lastSharedRoom) setRoomInput(lastSharedRoom);
    setShowSharedSetup(true);
  };

  const handleConfirmShared = () => {
    const target = roomInput.trim() || generateRoomId();
    applyRoomId(target, { creator: true });
    setRoomCreator(true);
    setModeChosen(true);
    setShowSharedSetup(false);
  };

  const handleCancelShared = () => {
    setShowSharedSetup(false);
    setRoomMode('local');
  };

  return (
    !modeChosen ? (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-gray-100 flex items-center justify-center p-6 relative">
        <div className="max-w-5xl w-full space-y-8 text-center">
          <div>
            <div className="text-3xl font-extrabold text-indigo-300 mb-2">モード選択</div>
            <div className="text-sm text-gray-400">アプリケーションの実行環境を選択してください</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={handleSelectLocal}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-700 hover:border-indigo-500 transition shadow-lg flex flex-col items-center gap-3"
            >
              <div className="p-4 rounded-full bg-indigo-600/20 text-indigo-300">
                <User size={32} />
              </div>
              <div className="text-xl font-bold">ローカル</div>
              <div className="text-sm text-gray-400 leading-relaxed">
                自分の端末内だけで完結します。通信を行わず、個人的に使用する場合に最適です。
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-green-400"></span> オフライン動作
              </div>
            </button>
            <button
              onClick={handleOpenSharedSetup}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-700 hover:border-purple-500 transition shadow-lg flex flex-col items-center gap-3"
            >
              <div className="p-4 rounded-full bg-purple-600/20 text-purple-300">
                <Users size={32} />
              </div>
              <div className="text-xl font-bold">共有（オンライン）</div>
              <div className="text-sm text-gray-400 leading-relaxed">
                データをクラウドで同期します。チームや友人と情報を共有する場合に最適です。
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-blue-400"></span> インターネット接続が必要
              </div>
            </button>
          </div>
        </div>
        {showSharedSetup && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-3">
              <div className="text-lg font-bold text-purple-200 flex items-center gap-2">
                <Users size={18} /> 共有ルームに参加 / 発行
              </div>
              <div className="text-sm text-gray-400">
                ルームIDを入力するか、発行ボタンで新しいIDを生成してください。
              </div>
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                placeholder="ルームIDを入力"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRoomInput(generateRoomId())}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-sm text-white py-2 rounded"
                >
                  ルームID発行
                </button>
                <button
                  onClick={() => {
                    if (lastSharedRoom) setRoomInput(lastSharedRoom);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-sm text-white py-2 rounded disabled:opacity-40"
                  disabled={!lastSharedRoom}
                >
                  前回のIDを使う
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelShared}
                  className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded text-gray-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmShared}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded text-white font-semibold"
                >
                  開始する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
    <div className="flex flex-col h-screen bg-black text-gray-200 overflow-hidden font-sans relative">
      {actionMessage && (
        <div className="absolute top-2 left-2 z-50 bg-blue-900/80 text-xs px-3 py-2 rounded shadow">
          {actionMessage}
        </div>
      )}
      {isOwner && normalizedPending.length > 0 && (
        <div className="absolute top-2 right-2 z-50 bg-slate-800/90 border border-slate-600 rounded-lg shadow-lg p-3 w-72">
          <div className="text-sm font-bold mb-2">承認待ち ({normalizedPending.length})</div>
          <div className="space-y-2 max-h-60 overflow-auto">
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
          <div className="text-xl font-bold mb-2">オーナーの承認が必要です</div>
          <div className="text-sm text-gray-300 mb-4">
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
        <div className="absolute top-2 right-2 z-50 bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded shadow">
          Firebase disabled (local demo mode)
        </div>
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
      <input
        type="file"
        ref={iconFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleIconFileSelect}
      />
      <input
        type="file"
        ref={newMarkerIconInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleNewMarkerUpload}
      />

      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-30 shadow-lg shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-fit">
          <ShieldAlert className="text-orange-500 w-5 h-5" />
          <h1 className="font-bold text-base tracking-wider text-gray-100">TACTICAL</h1>
          <button
            onClick={() => {
              setModeChosen(false);
              setRoomMode("local");
              setRoomId(null);
              setRoomInput(lastSharedRoom || "");
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-bold transition-all shadow-md"
          >
            モード選択へ
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
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
            placeholder="新規プロファイル名"
            className="w-32 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          />
          <button
            onClick={() => {
              addProfile(newProfileName || `攻略${profiles.length + 1}`);
              setNewProfileName('');
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 whitespace-nowrap"
          >
            追加
          </button>
          <input
            value={renameProfileName}
            onChange={(e) => setRenameProfileName(e.target.value)}
            placeholder="プロファイル名を変更"
            className="w-32 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          />
          <button
            onClick={() => {
              renameProfile(renameProfileName);
              setRenameProfileName('');
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 whitespace-nowrap"
          >
            リネーム
          </button>
          <button
            onClick={() => {
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
                }));
                setLocalPins((prev) => [...prev, ...copied]);
              } else {
                sourcePins.forEach((p) => {
                  addDoc(collection(db, 'artifacts', appId, 'public', 'data', `${roomId}_pins`), {
                    ...p,
                    id: undefined,
                    createdAt: serverTimestamp(),
                    profileId: candidate,
                    note: p.note || '',
                  });
                });
              }
              setActiveProfile(candidate);
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 whitespace-nowrap"
          >
            コピー
          </button>
          <button
            onClick={async () => {
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
            }}
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 whitespace-nowrap"
          >
            削除
          </button>
          <button
            onClick={() => setSelectedTool('custom_pin')}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded border transition-all whitespace-nowrap ${
              selectedTool === 'custom_pin'
                ? 'bg-orange-600 text-white border-orange-400'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
            }`}
          >
            <MapPin size={14} />
            Drop Pin
          </button>
        </div>

        <div className="flex items-center gap-3 min-w-fit">
          <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1 border border-gray-700">
            <span className="text-xs text-gray-400">名前</span>
            <input
              type="text"
              value={displayName}

              onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
              placeholder="記載者名"
              className="bg-transparent text-sm text-white outline-none w-28"
            />
          </div>
          <button
            onClick={copyRoomLink}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium transition-all"
          >
            共有
          </button>
          <button
            onClick={takeScreenshot}
            className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1"
            title="スクリーンショット"
          >
            <Download size={14} />
          </button>
        </div>
      </header>

      {config.layers && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex gap-2 bg-black/80 backdrop-blur p-1 rounded-lg border border-gray-700">
          {config.layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setCurrentLayer(layer.id)}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded transition-all ${
                currentLayer === layer.id ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Layers size={14} />
              {layer.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 relative flex overflow-hidden">
        <div className="w-64 bg-gray-900/95 backdrop-blur border-r border-gray-800 flex flex-col z-20 shadow-xl shrink-0 overflow-hidden">
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
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2">
                <div className="w-24 bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 flex items-center justify-center font-bold">
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
                  className="px-3 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                  disabled={roomMode === "local"}
                >
                  接続/発行
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
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
                            onClick={() => setSelectedTool(marker.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedTool(marker.id);
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-xs transition-all cursor-pointer ${
                              isActive
                                ? 'bg-gray-700 text-white ring-1 ring-inset ring-gray-500'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                          >
                            {iconImage ? (
                              <img
                                src={iconImage}
                                alt={`${marker.label} icon`}
                                className="w-5 h-5 rounded-full object-cover border border-gray-600/60"
                              />
                            ) : (
                              <MarkerIcon size={16} color={category.color} />
                            )}
                            <span className="flex-1 text-left truncate">{marker.label}</span>
                            <span className="text-[11px] text-gray-400">{count}</span>
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerIconUpload(marker.id);
                                }}
                                className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                                title="アイコン画像を変更"
                              >
                                <Camera size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMarkerVisibility((prev) => ({ ...prev, [marker.id]: !visible }));
                                }}
                                className={`p-1 rounded border ${
                                  visible
                                    ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                                    : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-gray-300'
                                }`}
                                title={visible ? '非表示にする' : '表示する'}
                              >
                                <EyeOff size={12} />
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

        <div
          ref={mapWrapperRef}
          className="flex-1 relative overflow-hidden bg-black cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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

            // Base scale logic with Icon Size Slider support
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
                        <Heart
                          size={16}
                          color="#f87171"
                          fill="#f87171"
                          className="absolute -top-2 -right-2 drop-shadow-md pointer-events-none"
                        />
                      )}
                      {iconImage ? (
                        <img
                          src={iconImage}
                          alt="Custom pin"
                          className="w-8 h-8 rounded-full border border-black/40 object-cover"
                        />
                      ) : (
                        <PinIcon
                          size={24}
                          fill={category.color}
                          color="#000000"
                          strokeWidth={1.5}
                          className={isSelected ? 'text-white' : ''}
                        />
                      )}
                    </div>
                    {!isSelected && (
                      <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none border border-white/20 z-50">
                        {markerDef.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedPinId &&
            (() => {
              const pin = pins.find((p) => p.id === selectedPinId);
              if (!pin) return null;
            const markerDef = mergedMarkers[pin.type] || FALLBACK_MARKER;
            return (
              <PinPopup 
                pin={pin} 
                markerDef={markerDef} 
                  onClose={() => setSelectedPinId(null)}
                  onUpdateImage={updatePinImage}
                  onUpdateIcon={updatePinIcon}
                  onUpdateNote={updatePinNote}
                  onMark={(id) => {
                    setMarkedPinIds((prev) =>
                      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
                    );
                    setSelectedPinId(id);
                  }}
                  onDelete={deletePin}
                />
              );
            })()}

          {/* ======================
              COMPACT CONTROLS (disabled, replaced by modal)
             ====================== */}
          {false && (
          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-10 pointer-events-none">
            {/* Button container (pointer-events-auto to enable interaction) */}
            <div className="pointer-events-auto flex gap-2 items-center">
              {/* Icon Size Slider (Horizontal) */}
              {showSettings && (
                <div className="flex items-center gap-2 mr-2">
                  <div className="relative flex items-center bg-black/20 backdrop-blur-sm rounded-full px-3 h-10 border border-gray-700/50 animate-in fade-in slide-in-from-right-4">
                    <Scaling size={16} className="text-gray-400 mr-2" />
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={iconBaseScale}
                      onChange={(e) => setIconBaseScale(parseFloat(e.target.value))}
                      className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  <button
                    onClick={resetAllIcons}
                    className="px-3 py-2 text-xs font-semibold rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 shadow"
                    title="アイコンを初期状態に戻す（public/icon の画像を使用）"
                  >
                    アイコン初期化
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-full shadow-lg border transition-all ${
                  showSettings
                    ? 'bg-gray-700 text-white border-gray-500'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700'
                }`}
                title="表示設定"
              >
                <Settings size={20} />
              </button>

              <div className="flex flex-col gap-2">
                {/* Map Zoom Slider (Vertical) */}
                {showSettings && (
                  <div className="absolute bottom-24 right-1 h-32 w-8 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
                    {/* Wrapper to rotate input */}
                    <div className="h-32 w-32 flex items-center justify-center -rotate-90 transform origin-center">
                      <input
                        type="range"
                        min="0.2"
                        max="5"
                        step="0.1"
                        value={transform.scale}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500 shadow-lg"
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-4 right-4 flex items-end gap-3 z-10 pointer-events-none">
        <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-700/50 shadow pointer-events-auto">
          <Scaling size={16} className="text-gray-400" />
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={iconBaseScale}
            onChange={(e) => setIconBaseScale(parseFloat(e.target.value))}
            className="w-28 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="flex flex-col items-center gap-3 pointer-events-auto">
          <div className="relative h-40 w-12 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full border border-gray-700/50 shadow">
            <div className="-rotate-90 w-28">
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
            title="設定"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {showShareToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow-xl z-50 animate-bounce pointer-events-none">
          リンクをコピーしました
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <div className="flex-1 space-y-2 text-sm text-gray-300">
                <div className="text-xs text-gray-400">初期アイコンに戻すピン種類</div>
                <select
                  value={resetTargetId}
                  onChange={(e) => setResetTargetId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                >
                  {Object.values(mergedMarkers).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => resetMarkerIcon(resetTargetId)}
                  disabled={!resetTargetId || isResettingIcon}
                  className="px-3 py-2 text-xs font-semibold rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  アイコン初期化
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-2 text-xs font-semibold rounded bg-orange-600 hover:bg-orange-500 text-white"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMarkerDialog && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">新しいピンを追加</h3>
              <button onClick={() => setShowMarkerDialog(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="text-xs text-gray-400">カテゴリ: {newMarkerCat && MARKER_CATEGORIES[newMarkerCat]?.label}</div>
            <input
              value={newMarkerName}
              onChange={(e) => setNewMarkerName(e.target.value)}
              placeholder="ピン名を入力"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
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
                className="px-3 py-2 text-xs rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={confirmAddCustomMarker}
                className="px-3 py-2 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    )
  );
}




