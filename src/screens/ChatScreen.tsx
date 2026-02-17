import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { EmptyState } from '../components';
import { useChatStore, useAuthStore, useUsageStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, PLAN_MAP } from '../constants';
import { ChatMessage } from '../types';

export default function ChatScreen() {
  const { messages, isLoading, error, loadMessages, sendMessage, clearChat } =
    useChatStore();
  const { user } = useAuthStore();
  const { chatUsedThisMonth, loadUsage } = useUsageStore();
  const navigation = useNavigation<any>();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // 使用上限チェック（ローカルDB）
  const planInfo = user ? PLAN_MAP[user.plan] : null;
  const isOverLimit = planInfo ? chatUsedThisMonth >= planInfo.chatLimit : false;

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      loadUsage();
    }, [])
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (!user) return;

    if (isOverLimit) {
      Alert.alert(
        '利用上限',
        '今月のAI相談回数が上限に達しました。プランをアップグレードしてください。',
        [
          { text: 'キャンセル' },
          {
            text: 'プラン変更',
            onPress: () => navigation.navigate('PlanSelect'),
          },
        ]
      );
      return;
    }

    const text = inputText.trim();
    setInputText('');
    await sendMessage(text, user.uid);
  };

  const handleClear = () => {
    Alert.alert(
      'チャット履歴を削除',
      '会話履歴をすべて削除しますか？',
      [
        { text: 'キャンセル' },
        {
          text: '削除',
          style: 'destructive',
          onPress: clearChat,
        },
      ]
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🐣</Text>
          </View>
        )}
        <View
          style={[
            styles.messageContent,
            isUser ? styles.userContent : styles.aiContent,
          ]}
        >
          <Text style={[styles.messageText, isUser && styles.userText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeEmoji}>🐣</Text>
      <Text style={styles.welcomeTitle}>シュッピくんだよ！</Text>
      <Text style={styles.welcomeMessage}>
        家計のことなら何でも聞いてね！{'\n'}
        節約のコツや、支出の分析をお手伝いするよ✨
      </Text>

      {/* クイックアクション */}
      <View style={styles.quickActions}>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.quickButton}
            onPress={() => setInputText(prompt)}
          >
            <Text style={styles.quickButtonText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* ヘッダーアクション */}
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={18} color={COLORS.textLight} />
          <Text style={styles.clearText}>履歴クリア</Text>
        </TouchableOpacity>
        {planInfo && user && (
          <Text style={styles.usageText}>
            残り {planInfo.chatLimit - chatUsedThisMonth}回
          </Text>
        )}
      </View>

      {/* メッセージ一覧 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderWelcome}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      {/* ローディング表示 */}
      {isLoading && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>シュッピくんが考え中... 💭</Text>
        </View>
      )}

      {/* エラー表示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* 入力エリア */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          placeholder="シュッピくんに相談する..."
          placeholderTextColor={COLORS.textLight}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons
            name="send"
            size={20}
            color={
              inputText.trim() && !isLoading
                ? COLORS.textOnPrimary
                : COLORS.textLight
            }
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const QUICK_PROMPTS = [
  '今月の支出を分析して',
  '食費を減らすコツは？',
  '先月と比較して',
  '節約のアドバイスちょうだい',
];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
  },
  usageText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  messageList: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  aiAvatarText: {
    fontSize: 20,
  },
  messageContent: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    maxWidth: '100%',
  },
  userContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiContent: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  messageText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.textOnPrimary,
  },
  typingIndicator: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  typingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  errorBanner: {
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  welcomeEmoji: {
    fontSize: 64,
  },
  welcomeTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  welcomeMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  quickButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  quickButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
