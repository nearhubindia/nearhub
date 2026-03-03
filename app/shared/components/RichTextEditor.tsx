import React, { useState, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const MAX_CHARS = 1200;

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  onAIGenerate?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
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
}: RichTextEditorProps) {
  const [selectedRange, setSelectedRange] = useState({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);

  // Simplified formatting: store markdown-style formatting
  const addFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const { start, end } = selectedRange;
    if (start === end) return; // No selection

    const selectedText = value.substring(start, end);
    let formattedText = selectedText;

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
  };

  const addBulletPoint = () => {
    const cursorPos = selectedRange.start;
    const beforeText = value.substring(0, cursorPos);
    const afterText = value.substring(cursorPos);
    const newValue = beforeText + '\n• ' + afterText;
    onChange(newValue);
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
});
