import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { C } from '@/lib/theme';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';

// ---- Shared styles: rebuilt (in place) whenever the palette changes, see ThemeProvider ----

const make = () =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    card: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
    muted: { color: C.muted, fontSize: 13 },
    h1: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
    label: { color: C.muted, fontSize: 13, marginBottom: 6 },
    input: { backgroundColor: C.card, borderRadius: 12, color: C.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
    sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  });
export const s = make();
export function rebuildStyles() {
  Object.assign(s, make());
}

// ---- Buttons / inputs ----

export function Button(p: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean;
  style?: StyleProp<ViewStyle>; icon?: IconName;
}) {
  const kind = p.kind ?? 'primary';
  const color = kind === 'primary' ? C.primaryInk : kind === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled || p.busy}
      style={({ pressed }) => [
        { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
        kind === 'primary' ? { backgroundColor: C.primary } : kind === 'danger' ? { backgroundColor: `${C.danger}14` } : { backgroundColor: C.card },
        (pressed || p.disabled) && { opacity: 0.55 }, p.style,
      ]}
    >
      {p.busy ? <ActivityIndicator color={color} /> : (
        <>
          {p.icon && <Icon name={p.icon} size={18} color={color} />}
          <Text style={{ color, fontWeight: '600', fontSize: 15 }}>{p.title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Input(p: TextInputProps) {
  return <TextInput placeholderTextColor={C.muted} selectionColor={C.primary} {...p} style={[s.input, p.multiline && { minHeight: 110, textAlignVertical: 'top' }, p.style]} />;
}

/** Outline pill (filters, quick actions). */
export function Pill({ label, icon, on, onPress }: { label: string; icon?: IconName; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99,
      borderWidth: 1, borderColor: on ? C.primary : C.line, backgroundColor: on ? `${C.primary}1a` : 'transparent' }, pressed && { opacity: 0.7 }]}>
      {icon && <Icon name={icon} size={16} color={on ? C.primary : C.text} />}
      <Text style={{ color: on ? C.primary : C.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Underlined tabs (Aujourd'hui / Habitudes / Statistiques). */
export function Tabs<T extends string>({ items, value, onChange }: { items: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
      {items.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: value === k ? C.primary : 'transparent', marginBottom: -StyleSheet.hairlineWidth }}>
          <Text style={{ color: value === k ? C.text : C.muted, fontSize: 14.5, fontWeight: '600' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 6 }}>
      <Text style={s.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

export const Hairline = () => <View style={s.hairline} />;

/** Flat list row with a hairline underneath (the "Épuré" look). */
export function ListRow({ left, title, subtitle, right, onPress, last, danger }: {
  left?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.line }, pressed && { opacity: 0.6 }]}>
      {left}
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: danger ? C.danger : C.text, fontSize: 15.5, fontWeight: '600' }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={s.muted}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chevron-right" size={18} color={C.muted} /> : null)}
    </Pressable>
  );
}

export function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color ? `${color}26` : C.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: color ?? C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 36, gap: 6 }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      {hint && <Text style={{ color: C.muted, textAlign: 'center', lineHeight: 20 }}>{hint}</Text>}
    </View>
  );
}

/** Round progress indicator built from plain Views (no extra native module). */
export function Ring({ pct, size = 110, stroke = 10, color, track, children }: {
  pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const p = Math.max(0, Math.min(1, pct));
  const col = color ?? C.primary;
  const half = (side: 'right' | 'left', rot: number) => (
    <View style={{ position: 'absolute', top: 0, left: side === 'right' ? size / 2 : 0, width: size / 2, height: size, overflow: 'hidden' }}>
      <View style={{
        position: 'absolute', top: 0, left: side === 'right' ? -size / 2 : 0, width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: 'transparent',
        ...(side === 'right' ? { borderTopColor: col, borderRightColor: col } : { borderBottomColor: col, borderLeftColor: col }),
        transform: [{ rotate: `${rot}deg` }],
      }} />
    </View>
  );
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: track ?? C.track }} />
      {p > 0 && half('right', -135 + Math.min(p, 0.5) * 360)}
      {p > 0.5 && half('left', -135 + (p - 0.5) * 360)}
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

/** Cross-platform replacement for Alert.prompt (iOS only). */
export function PromptModal(p: {
  visible: boolean; title: string; initial?: string; placeholder?: string;
  onCancel: () => void; onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(p.initial ?? '');
  useEffect(() => setValue(p.initial ?? ''), [p.visible, p.initial]);
  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: C.panel, borderRadius: 20, padding: 20, gap: 14 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{p.title}</Text>
          <Input autoFocus value={value} onChangeText={setValue} placeholder={p.placeholder} onSubmitEditing={() => value.trim() && p.onSubmit(value.trim())} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button kind="ghost" title="Annuler" onPress={p.onCancel} />
            <Button title="OK" disabled={!value.trim()} onPress={() => p.onSubmit(value.trim())} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Bottom sheet. */
export function Sheet(p: { visible: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }} onPress={p.onClose}>
        <Pressable style={{ backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 30 }} onPress={() => {}}>
          <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 8 }} />
          {p.title ? <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 22, paddingVertical: 8 }}>{p.title}</Text> : null}
          <ScrollView bounces={false} style={{ maxHeight: 520 }}>{p.children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetRow({ icon, label, onPress, selected, danger }: { icon?: IconName; label: string; onPress: () => void; selected?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 14 }, pressed && { backgroundColor: C.surface }]}>
      {icon && <Icon name={icon} size={21} color={danger ? C.danger : C.muted} />}
      <Text style={{ flex: 1, color: danger ? C.danger : C.text, fontSize: 16 }}>{label}</Text>
      {selected && <Icon name="check" size={19} color={C.primary} />}
    </Pressable>
  );
}
