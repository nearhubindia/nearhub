import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import RichTextPreview from '@/shared/components/RichTextPreview';

const MAX_CHARS = 1200;

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  onAIGenerate?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  showPreview?: boolean;
  previewLabel?: string;
}

/**
 * RichTextEditor Component
 * Supports formatting: bold, italic, underline
 * Character limit: 1200
 * Includes AI integration for description generation
 */
export default function RichTextEditor({
  value,
  onChange,
  onAIGenerate,
  isGenerating = false,
  placeholder = 'Describe your item...',
  showPreview = false,
  previewLabel = 'Live Preview',
}: RichTextEditorProps) {
  const [selectedRange, setSelectedRange] = useState({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);

  const applyTextChange = (nextValue: string, nextCursor: number) => {
    onChange(nextValue);
    setSelectedRange({ start: nextCursor, end: nextCursor });
    textInputRef.current?.focus();
  };

  const addFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const start = Math.min(selectedRange.start, selectedRange.end);
    const end = Math.max(selectedRange.start, selectedRange.end);
    const hasSelection = end > start;
    const selectedText = value.substring(start, end);

    const markers = {
      bold: '**',
      italic: '_',
      underline: '__',
    } as const;

    const prefix = markers[format];
    const suffix = markers[format];
    const insertedText = hasSelection ? `${prefix}${selectedText}${suffix}` : `${prefix}${suffix}`;
    const nextValue = value.substring(0, start) + insertedText + value.substring(end);
    const nextCursor = hasSelection ? start + insertedText.length : start + prefix.length;

    applyTextChange(nextValue, nextCursor);
  };

  const addBulletPoint = () => {
    const start = Math.min(selectedRange.start, selectedRange.end);
    const end = Math.max(selectedRange.start, selectedRange.end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    const hasSelection = end > start;
    const needsLeadingNewLine = beforeText.length > 0 && !beforeText.endsWith('\n');
    const bulletPrefix = needsLeadingNewLine ? '\n• ' : '• ';
    const selectedText = value.substring(start, end);
    const insertedText = hasSelection ? `${bulletPrefix}${selectedText}` : bulletPrefix;
    const nextValue = beforeText + insertedText + afterText;

    applyTextChange(nextValue, start + insertedText.length);
  };

  const charCountColor =
    value.length > 1000 ? '#FF6B6B' : value.length > 900 ? '#FFA500' : Colors.textTertiary;
  const charCountPercentage = (value.length / MAX_CHARS) * 100;

  return (
    <View>
      {/* Text Input */}
      <TextInput
        ref={textInputRef}
        style={[styles.input, styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => setSelectedRange(e.nativeEvent.selection)}
        selection={selectedRange}
        maxLength={MAX_CHARS}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      {/* Formatting Toolbar & Character Count */}
      <View style={styles.bottomBar}>
        <View style={styles.toolbarContainer}>
          {/* Format Buttons */}
          <View style={styles.toolbar}>
            <Pressable
              style={[styles.toolButton, styles.toolButtonCompact]}
              onPress={() => addFormatting('bold')}
            >
              <Text style={styles.toolButtonText}>B</Text>
            </Pressable>

            <Pressable
              style={[styles.toolButton, styles.toolButtonCompact]}
              onPress={() => addFormatting('italic')}
            >
              <Text style={[styles.toolButtonText, { fontStyle: 'italic' }]}>I</Text>
            </Pressable>

            <Pressable
              style={[styles.toolButton, styles.toolButtonCompact]}
              onPress={() => addFormatting('underline')}
            >
              <Text style={[styles.toolButtonText, { textDecorationLine: 'underline' }]}>U</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={[styles.toolButton, styles.toolButtonCompact]}
              onPress={addBulletPoint}
            >
              <Feather name="list" size={16} color={Colors.primary} />
            </Pressable>
          </View>

          {/* AI Button */}
          {onAIGenerate && (
            <Pressable
              style={[styles.aiButton, isGenerating && styles.aiButtonDisabled]}
              onPress={onAIGenerate}
              disabled={isGenerating}
            >
              <Feather name="zap" size={14} color="#fff" />
              <Text style={styles.aiButtonText}>{isGenerating ? 'Generating...' : 'AI'}</Text>
            </Pressable>
          )}
        </View>

        {/* Character Count Bar */}
        <View style={styles.charCountContainer}>
          <View style={[styles.charCountBar, { width: `${charCountPercentage}%` }]} />
        </View>
        <Text style={[styles.charCount, { color: charCountColor }]}>
          {value.length}/{MAX_CHARS} characters
        </Text>
      </View>

      {/* Help Text */}
      <Text style={styles.helpText}>
        💡 Use **bold**, _italic_, __underline__ for formatting. Add • for lists.
      </Text>

      {showPreview && value.trim().length > 0 && (
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Feather name="eye" size={13} color={Colors.primary} />
            <Text style={styles.previewHeaderText}>{previewLabel}</Text>
          </View>
          <RichTextPreview text={value} textStyle={styles.previewText} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    minHeight: 120,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  bottomBar: {
    marginTop: 8,
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  toolButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonCompact: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  toolButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 4,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  charCountContainer: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  charCountBar: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  helpText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  previewCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewHeaderText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
  },
});
