import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { C } from '@/lib/theme';

export function Button(p: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const kind = p.kind ?? 'primary';
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled || p.busy}
      style={({ pressed }) => [
        s.btn, kind === 'primary' ? s.btnPrimary : s.btnGhost, (pressed || p.disabled) && { opacity: 0.6 }, p.style,
      ]}
    >
      {p.busy ? (
        <ActivityIndicator color={kind === 'primary' ? C.primaryInk : C.text} />
      ) : (
        <Text style={[s.btnText, kind === 'primary' ? { color: C.primaryInk } : { color: kind === 'danger' ? C.danger : C.text }]}>
          {p.title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(p: TextInputProps) {
  return <TextInput placeholderTextColor={C.muted} {...p} style={[s.input, p.multiline && { minHeight: 110, textAlignVertical: 'top' }, p.style]} />;
}

export function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[s.chip, color ? { backgroundColor: color + '26' } : null]}>
      <Text style={[s.chipText, color ? { color } : null]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 6 }}>
      <Text style={{ color: C.text, fontSize: 16 }}>{title}</Text>
      {hint && <Text style={{ color: C.muted, textAlign: 'center' }}>{hint}</Text>}
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.dialog}>
          <Text style={s.dialogTitle}>{p.title}</Text>
          <Input autoFocus value={value} onChangeText={setValue} placeholder={p.placeholder}
            onSubmitEditing={() => value.trim() && p.onSubmit(value.trim())} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button kind="ghost" title="Annuler" onPress={p.onCancel} />
            <Button title="OK" disabled={!value.trim()} onPress={() => p.onSubmit(value.trim())} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Bottom sheet with a list of actions. */
export function Sheet(p: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable style={[s.backdrop, { justifyContent: 'flex-end', padding: 0 }]} onPress={p.onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>{p.children}</Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.sheetRow, pressed && { backgroundColor: '#ffffff10' }]}>
      <Text style={{ fontSize: 22, width: 32 }}>{icon}</Text>
      <Text style={{ color: C.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: C.primary },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: C.bg, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
  },
  chip: { alignSelf: 'flex-start', backgroundColor: '#ffffff14', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: C.panel, borderRadius: 16, padding: 18, gap: 14, borderWidth: 1, borderColor: C.line },
  dialogTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  sheet: {
    backgroundColor: C.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34,
    borderWidth: 1, borderColor: C.line,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  muted: { color: C.muted, fontSize: 13 },
  h1: { color: C.text, fontSize: 26, fontWeight: '800' },
  label: { color: C.muted, fontSize: 13, marginBottom: 6 },
});
