import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  updateDoc,
  serverTimestamp,
  query,
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
  Anchor,
  Tent,
  Skull,
  Radio,
  Key,
  CircleDot,
  Crown,
  Heart,
  EyeOff,
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

const MAP_CONFIG = {
  dam: {
    id: 'dam',
    name: 'ダム戦場',
    width: 2000,
    height: 2000,
    defaultUrl: '/maps/dam.jpg',
    bgColor: '#1a1d21',
    gridColor: '#2a2e33',
  },
  spaceport: {
    id: 'spaceport',
    name: '宇宙港',
    width: 2400,
    height: 1600,
    defaultUrl: '/maps/spaceport.jpg',
    bgColor: '#161b22',
    gridColor: '#1f2937',
  },
  buried: {
    id: 'buried',
    name: '埋もれた町',
    width: 2000,
    height: 2000,
    defaultUrl: '/maps/buried.jpg',
    bgColor: '#1f1a16',
    gridColor: '#332b25',
  },
  bluegate: {
    id: 'bluegate',
    name: 'ブルーゲート',
    width: 2400,
    height: 1600,
    defaultUrl: '/maps/bluegate.jpg',
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
      { id: 'upper', name: '地上 (施設)', defaultUrl: '/maps/stella_upper.jpg' },
      { id: 'lower', name: '地下 (メトロ)', defaultUrl: '/maps/stella_lower.jpg' },
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
  surveyor: { id: 'surveyor', cat: 'arc', label: 'arc偵察機', icon: Eye },
  sentinel: { id: 'sentinel', cat: 'arc', label: 'センチネル', icon: ShieldAlert },
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
  surveyor: '/icon/surveyor.svg',
  sentinel: '/icon/sentinel.svg',
  rocketeer_arc: '/icon/rocketeer.svg',
  leaper: '/icon/leaper.svg',
  bombardier: '/icon/bombardier.svg',
  bastion: '/icon/bastion.svg',
  queen: '/icon/queen.svg',
  matriarch: '/icon/apricot_tree.svg',

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

const PinPopup = ({ pin, markerDef, onClose, onUpdateImage, onUpdateIcon, onDelete, onMark }) => {
  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const categoryDef = MARKER_CATEGORIES[markerDef.cat] || MARKER_CATEGORIES.others;

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

        <div className="text-xs text-gray-500 mb-4">ID: {pin.id.slice(0, 6)}... によって発見</div>

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
export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [currentMap, setCurrentMap] = useState('dam');
  const [currentLayer, setCurrentLayer] = useState(null);
  const [localImages, setLocalImages] = useState({});

  const [pins, setPins] = useState([]);
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

  const [selectedTool, setSelectedTool] = useState('move');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.4 });
  const [iconBaseScale, setIconBaseScale] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showShareToast, setShowShareToast] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const canSync = useMemo(() => useFirebase && Boolean(roomId), [roomId]);

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
    setRoomId(roomParam || null);
  }, []);

  useEffect(() => {
    const config = MAP_CONFIG[currentMap];
    if (config.layers && config.layers.length > 0) setCurrentLayer(config.layers[0].id);
    else setCurrentLayer(null);
    centerMap();
  }, [currentMap]);

  useEffect(() => {
    if (!canSync || !auth || !db || !user) return;
    const collectionName = `${roomId}_pins`;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedPins = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPins(loadedPins);
      },
      (error) => console.error(error),
    );
    return () => unsubscribe();
  }, [user, roomId]);

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
    setPins((prev) => prev.map((p) => (p.type === markerId ? { ...p, iconUrl: defaultIcon } : p)));

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
    if (isDragging || !user) return;

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

    if (!canSync) {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPins((prev) => [
        ...prev,
        {
          id: localId,
          mapId: currentMap,
          layerId: currentLayer,
          x,
          y,
          type: selectedTool,
          iconUrl: markerIcons[selectedTool] || undefined,
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
    if (!user) return;
    if (!canSync) {
      setPins((prev) => prev.filter((p) => p.id !== pinId));
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
    if (!user) return;
    if (!canSync) {
      setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, imageUrl: base64Image } : p)));
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
    if (!user) return;
    addIconToLibrary(base64Icon);
    if (!canSync) {
      setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, iconUrl: base64Icon } : p)));
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

  const copyRoomLink = () => {
    const activeRoomId = roomId || generateRoomId();
    if (!roomId) {
      setRoomId(activeRoomId);
      const params = new URLSearchParams(window.location.search);
      params.set('room', activeRoomId);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
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

  return (
    <div className="flex flex-col h-screen bg-black text-gray-200 overflow-hidden font-sans relative">
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
        <div className="flex items-center gap-2 min-w-fit">
          <ShieldAlert className="text-orange-500 w-5 h-5" />
          <h1 className="font-bold text-base tracking-wider text-gray-100">TACTICAL</h1>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
          <div className="flex items-center bg-gray-800 rounded p-0.5 gap-1 overflow-x-auto scrollbar-hide">
            {Object.values(MAP_CONFIG).map((map) => (
              <button
                key={map.id}
                onClick={() => setCurrentMap(map.id)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors uppercase whitespace-nowrap ${
                  currentMap === map.id
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {map.name}
              </button>
            ))}
          </div>

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
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200"
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
  );
}
