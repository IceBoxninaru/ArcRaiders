import React, { useState, useEffect, useRef } from 'react';
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
  Minus,
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
  Maximize,
  Minimize,
  Scaling,
  Briefcase,
  Package,
  PlusSquare,
  Bug,
  Eye,
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
  weapon_case: { id: 'weapon_case', cat: 'containers', label: '武器ケース', icon: Briefcase },
  ammo: { id: 'ammo', cat: 'containers', label: '弾薬箱', icon: Package },
  med: { id: 'med', cat: 'containers', label: 'メッドバッグ', icon: PlusSquare },
  grenade: { id: 'grenade', cat: 'containers', label: 'グレネード', icon: CircleDot },
  backpack: { id: 'backpack', cat: 'containers', label: 'バックパック', icon: Briefcase },
  wasp: { id: 'wasp', cat: 'containers', label: 'スズメバチの殻', icon: CircleDot },
  probe: { id: 'probe', cat: 'containers', label: '墜落した探査機', icon: Radio },
  lockbox: { id: 'lockbox', cat: 'containers', label: 'セキュリティロック', icon: Key },
  tick: { id: 'tick', cat: 'arc', label: '小型機 (Tick/Pop)', icon: Bug },
  drone: { id: 'drone', cat: 'arc', label: 'ドローン/火の玉', icon: Eye },
  turret: { id: 'turret', cat: 'arc', label: '砲塔', icon: Zap },
  rocket: { id: 'rocket', cat: 'arc', label: 'ロケットマン', icon: Bot },
  heavy: { id: 'heavy', cat: 'arc', label: '大型機 (Sentinel等)', icon: ShieldAlert },
  mushroom: { id: 'mushroom', cat: 'nature', label: 'キノコ', icon: Sprout },
  plant: { id: 'plant', cat: 'nature', label: '植物/実', icon: Flower },
  harvester: { id: 'harvester', cat: 'events', label: 'ハーベスター', icon: Zap },
  cache: { id: 'cache', cat: 'events', label: 'レイダーキャッシュ', icon: Package },
  elevator: { id: 'elevator', cat: 'others', label: 'エレベーター', icon: Anchor },
  hatch: { id: 'hatch', cat: 'others', label: 'ハッチ', icon: DoorOpen },
  supply: { id: 'supply', cat: 'others', label: '補給ステーション', icon: Radio },
  camp: { id: 'camp', cat: 'others', label: 'レイダーキャンプ', icon: Tent },
  spawn: { id: 'spawn', cat: 'others', label: 'プレイヤースポーン', icon: User },
  quest: { id: 'quest', cat: 'others', label: 'クエスト', icon: MapPin },
  locked_room: { id: 'locked_room', cat: 'others', label: '鍵のかかった部屋', icon: Key },
  extract: { id: 'extract', cat: 'others', label: '脱出地点', icon: Flag },
};

const FALLBACK_MARKER = { id: 'unknown', cat: 'others', label: 'その他', icon: CircleDot };

/* ========================================
  HELPER UTILS
  ========================================
*/

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

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

const PinPopup = ({ pin, markerDef, onClose, onUpdateImage, onDelete }) => {
  const fileInputRef = useRef(null);
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

        <div className="flex gap-2">
          <button
            onClick={() => alert('場所をマークしました（デモ）')}
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

  const [selectedTool, setSelectedTool] = useState('move');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.4 });
  const [iconBaseScale, setIconBaseScale] = useState(1.0);
  const [showSettings, setShowSettings] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showShareToast, setShowShareToast] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const [openCategories, setOpenCategories] = useState({
    containers: true,
    arc: true,
    others: true,
    nature: true,
    events: true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const mapRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem('tactical_display_name');
    if (savedName) setDisplayName(savedName);
  }, []);

  useEffect(() => {
    if (displayName) localStorage.setItem('tactical_display_name', displayName);
  }, [displayName]);

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
    if (roomParam) setRoomId(roomParam);
    else setRoomId(generateRoomId());
  }, []);

  useEffect(() => {
    const config = MAP_CONFIG[currentMap];
    if (config.layers && config.layers.length > 0) setCurrentLayer(config.layers[0].id);
    else setCurrentLayer(null);
    centerMap();
  }, [currentMap]);

  useEffect(() => {
    if (!useFirebase || !auth || !db || !user || !roomId) return;
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
    if (isDragging || !user || !roomId) return;

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

    if (!useFirebase) {
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
          createdAt: new Date(),
          createdBy: user?.uid || 'local',
          createdByName: displayName || '匿名',
        },
      ]);
      setSelectedPinId(localId);
      setSelectedTool('move');
      return;
    }

    try {
      const collectionName = `${roomId}_pins`;
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), {
        mapId: currentMap,
        layerId: currentLayer,
        x,
        y,
        type: selectedTool,
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
    if (!user || !roomId) return;
    if (!useFirebase) {
      setPins((prev) => prev.filter((p) => p.id !== pinId));
      if (selectedPinId === pinId) setSelectedPinId(null);
      return;
    }
    const collectionName = `${roomId}_pins`;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId));
      if (selectedPinId === pinId) setSelectedPinId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const updatePinImage = async (pinId, base64Image) => {
    if (!user || !roomId) return;
    if (!useFirebase) {
      setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, imageUrl: base64Image } : p)));
      return;
    }
    const collectionName = `${roomId}_pins`;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, pinId), {
        imageUrl: base64Image,
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
    if (config.layers) return p.layerId === currentLayer;
    return true;
  });

  const toggleCategory = (catKey) => {
    setOpenCategories((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
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
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      })
      .catch(() => alert('Room ID: ' + roomId));
  };

  return (
    <div className="flex flex-col h-screen bg-black text-gray-200 overflow-hidden font-sans relative">
      {!useFirebase && (
        <div className="absolute top-2 right-2 z-50 bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded shadow">
          Firebase disabled (local demo mode)
        </div>
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />

      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-30 shadow-lg shrink-0 gap-4">
        <div className="flex items-center gap-2 min-w-fit">
          <ShieldAlert className="text-orange-500 w-5 h-5" />
          <h1 className="font-bold text-base tracking-wider text-gray-100">TACTICAL</h1>
        </div>

        <div className="flex items-center bg-gray-800 rounded p-0.5 gap-1 overflow-x-auto scrollbar-hide">
          {Object.values(MAP_CONFIG).map((map) => (
            <button
              key={map.id}
              onClick={() => setCurrentMap(map.id)}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors uppercase whitespace-nowrap ${
                currentMap === map.id ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {map.name}
            </button>
          ))}
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
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
            {Object.entries(MARKER_CATEGORIES).map(([catKey, category]) => (
              <div key={catKey} className="rounded overflow-hidden">
                <button
                  onClick={() => toggleCategory(catKey)}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-xs font-bold text-gray-300 transition-colors"
                >
                  <span>{category.label}</span>
                  {openCategories[catKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openCategories[catKey] && (
                  <div className="bg-black/20 p-1 space-y-0.5">
                    {Object.values(MARKERS)
                      .filter((m) => m.cat === catKey)
                      .filter((m) => m.label.includes(searchTerm))
                      .map((marker) => {
                        const MarkerIcon = marker.icon;
                        const isActive = selectedTool === marker.id;
                        return (
                          <button
                            key={marker.id}
                            onClick={() => setSelectedTool(marker.id)}
                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-xs transition-all ${
                              isActive
                                ? 'bg-gray-700 text-white ring-1 ring-inset ring-gray-500'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                          >
                            <MarkerIcon size={16} color={category.color} />
                            <span>{marker.label}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-800 text-[10px] text-gray-600 text-center">Room: {roomId}</div>
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
              const markerDef = MARKERS[pin.type] || FALLBACK_MARKER;
              const category = MARKER_CATEGORIES[markerDef.cat] || MARKER_CATEGORIES.others;
              const PinIcon = markerDef.icon;
              const isSelected = pin.id === selectedPinId;

              // Base scale logic with Icon Size Slider support
              const baseScale = Math.max(0.3, (1 / transform.scale) * iconBaseScale);
              const scale = isSelected ? baseScale * 2 : baseScale;
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
                      <PinIcon
                        size={24}
                        fill={category.color}
                        color="#000000"
                        strokeWidth={1.5}
                        className={isSelected ? 'text-white' : ''}
                      />
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
            const markerDef = MARKERS[pin.type] || FALLBACK_MARKER;
            return (
              <PinPopup 
                pin={pin} 
                markerDef={markerDef} 
                  onClose={() => setSelectedPinId(null)}
                  onUpdateImage={updatePinImage}
                  onDelete={deletePin}
                />
              );
            })()}

          {/* ======================
              COMPACT CONTROLS
             ====================== */}
          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-10 pointer-events-none">
            {/* Button container (pointer-events-auto to enable interaction) */}
            <div className="pointer-events-auto flex gap-2 items-center">
              {/* Icon Size Slider (Horizontal) */}
              {showSettings && (
                <div className="relative flex items-center bg-black/20 backdrop-blur-sm rounded-full px-3 h-10 border border-gray-700/50 mr-2 animate-in fade-in slide-in-from-right-4">
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

                <button 
                  onClick={() => setZoom(transform.scale + 0.2)}
                  className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg border border-gray-700 pointer-events-auto"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={() => setZoom(transform.scale - 0.2)}
                  className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg border border-gray-700 pointer-events-auto"
                >
                  <Minus size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showShareToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow-xl z-50 animate-bounce pointer-events-none">
          リンクをコピーしました
        </div>
      )}
    </div>
  );
}
