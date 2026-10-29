// Same line icons and folder tiles as the app. Folder icons are stored as "<lucide-name>:<accent>" (e.g. "plane:blue").
import {
  Bed, Bike, BookOpen, Bookmark, Briefcase, Camera, Car, Check, ChevronDown, ChevronRight, Download, Droplet, Dumbbell, ExternalLink, File,
  FileText, Folder, FolderPlus, Footprints, Gamepad2, GlassWater, GraduationCap, Headphones, Heart, House, Image, Images, Inbox, Laptop, Leaf,
  Link, LogOut, Menu, Mic, Monitor, Moon, Palette, PawPrint, PenLine, Pencil, Pill, Plane, Play, Plus, Rocket, Salad, Search, ShieldCheck,
  QrCode, ShoppingCart, Smartphone, Square, Star, Sun, SunMoon, Target, Trash2, Upload, Utensils, Video, Wallet, X, type LucideIcon,
} from 'lucide-react';

export const ICONS = {
  bed: Bed, bike: Bike, 'book-open': BookOpen, bookmark: Bookmark, briefcase: Briefcase, camera: Camera, car: Car, check: Check,
  'chevron-down': ChevronDown, 'chevron-right': ChevronRight, download: Download, droplet: Droplet, dumbbell: Dumbbell, 'external-link': ExternalLink,
  file: File, 'file-text': FileText, folder: Folder, 'folder-plus': FolderPlus, footprints: Footprints, 'gamepad-2': Gamepad2,
  'glass-water': GlassWater, 'graduation-cap': GraduationCap, headphones: Headphones, heart: Heart, house: House, image: Image, images: Images,
  inbox: Inbox, laptop: Laptop, leaf: Leaf, link: Link, 'log-out': LogOut, menu: Menu, mic: Mic, monitor: Monitor, moon: Moon, palette: Palette,
  'paw-print': PawPrint, 'qr-code': QrCode, 'pen-line': PenLine, pencil: Pencil, pill: Pill, plane: Plane, play: Play, plus: Plus, rocket: Rocket, salad: Salad,
  search: Search, 'shield-check': ShieldCheck, 'shopping-cart': ShoppingCart, smartphone: Smartphone, square: Square, star: Star, sun: Sun,
  'sun-moon': SunMoon, target: Target, trash: Trash2, upload: Upload, utensils: Utensils, video: Video, wallet: Wallet, x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color, strokeWidth = 1.75, className }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; className?: string;
}) {
  const I = ICONS[name];
  return <I size={size} color={color ?? 'currentColor'} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export const ACCENTS = {
  violet: '#8B7CFF', blue: '#4F9BFF', cyan: '#22B8E0', green: '#2FCB94', yellow: '#E9A93A', orange: '#FF8F5A', red: '#F2566B', pink: '#F25DA0',
} as const;
export type AccentName = keyof typeof ACCENTS;

export const ICON_CHOICES: IconName[] = [
  'folder', 'inbox', 'plane', 'dumbbell', 'footprints', 'bike', 'utensils', 'salad', 'glass-water', 'droplet', 'book-open', 'graduation-cap',
  'pen-line', 'laptop', 'briefcase', 'wallet', 'shopping-cart', 'house', 'heart', 'pill', 'bed', 'leaf', 'paw-print', 'car',
  'gamepad-2', 'headphones', 'camera', 'palette', 'rocket', 'target', 'star', 'bookmark',
];

const LEGACY: Record<string, string> = {
  '📁': 'folder:violet', '📥': 'inbox:violet', '🔖': 'bookmark:orange', '✈️': 'plane:blue', '🏋️': 'dumbbell:green', '🍳': 'utensils:orange',
  '💡': 'target:yellow', '📚': 'book-open:blue', '🎬': 'camera:pink', '🎵': 'headphones:pink', '💼': 'briefcase:blue', '🏠': 'house:cyan',
  '💻': 'laptop:cyan', '🎨': 'palette:pink', '🛒': 'shopping-cart:green', '❤️': 'heart:red',
};

export function parseIcon(icon: string | undefined): { name: IconName; accent: AccentName; color: string } {
  const [n, a] = (LEGACY[icon ?? ''] ?? icon ?? 'folder:violet').split(':');
  const name = (n in ICONS ? n : 'folder') as IconName;
  const accent = (a in ACCENTS ? a : 'violet') as AccentName;
  return { name, accent, color: ACCENTS[accent] };
}

/** Rounded tile with the colored line icon, used for folders. */
export function IconTile({ icon, size = 36 }: { icon?: string; size?: number }) {
  const { name, color } = parseIcon(icon);
  return (
    <span className="tile" style={{ width: size, height: size, borderRadius: size * 0.3, background: `${color}26`, color }}>
      <Icon name={name} size={size * 0.5} />
    </span>
  );
}
