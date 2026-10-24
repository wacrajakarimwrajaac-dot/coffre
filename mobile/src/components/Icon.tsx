import { Text, View } from 'react-native';
import { ICONS, type IconName } from '@/lib/icons';
import { ACCENTS, C, type AccentName } from '@/lib/theme';

export function Icon({ name, size = 22, color, strokeWidth = 1.75 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const I = ICONS[name];
  return <I size={size} color={color ?? C.text} strokeWidth={strokeWidth} />;
}

// ---- Folder / habit icons: stored as "<lucide-name>:<accent>" (e.g. "plane:blue"). Old emoji values still display. ----

export const ICON_CHOICES: IconName[] = [
  'folder', 'inbox', 'plane', 'dumbbell', 'footprints', 'bike', 'utensils', 'salad', 'glass-water', 'droplet', 'book-open', 'graduation-cap',
  'pen-line', 'laptop', 'briefcase', 'wallet', 'shopping-cart', 'house', 'heart', 'pill', 'bed', 'leaf', 'paw-print', 'car',
  'gamepad-2', 'headphones', 'camera', 'palette', 'rocket', 'target', 'star', 'bookmark',
];
export const ACCENT_CHOICES = Object.keys(ACCENTS) as AccentName[];

const LEGACY: Record<string, string> = {
  '📁': 'folder:violet', '📥': 'inbox:violet', '🔖': 'bookmark:orange', '✈️': 'plane:blue', '🏋️': 'dumbbell:green', '🍳': 'utensils:orange',
  '💡': 'target:yellow', '📚': 'book-open:blue', '🎬': 'camera:pink', '🎵': 'headphones:pink', '💼': 'briefcase:blue', '🏠': 'house:cyan',
  '💻': 'laptop:cyan', '🎨': 'palette:pink', '🛒': 'shopping-cart:green', '❤️': 'heart:red',
  '✅': 'target:green', '💪': 'dumbbell:green', '🏃': 'footprints:green', '💧': 'droplet:blue', '🧘': 'leaf:green', '🥗': 'salad:green',
  '😴': 'bed:violet', '💊': 'pill:pink', '🧹': 'house:cyan', '✍️': 'pen-line:orange', '🎯': 'target:red', '🎸': 'headphones:pink', '🌅': 'star:yellow', '🙏': 'heart:pink',
};

export function parseIcon(icon: string | undefined, fallback = 'folder:violet'): { name: IconName; accent: AccentName; color: string } {
  const raw = LEGACY[icon ?? ''] ?? icon ?? fallback;
  const [n, a] = raw.split(':');
  const name = (n in ICONS ? n : 'folder') as IconName;
  const accent = (a in ACCENTS ? a : 'violet') as AccentName;
  return { name, accent, color: ACCENTS[accent] };
}
export const makeIcon = (name: IconName, accent: AccentName) => `${name}:${accent}`;

/** Rounded tile with the colored line icon, used for folders and habits. */
export function IconTile({ icon, size = 40, fallback }: { icon?: string; size?: number; fallback?: string }) {
  const { name, color } = parseIcon(icon, fallback);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: `${color}26`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function Badge({ children }: { children: string }) {
  return <Text style={{ color: C.muted, fontSize: 12 }}>{children}</Text>;
}
