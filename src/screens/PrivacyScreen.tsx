import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>プライバシーポリシー</Text>
      <Text style={styles.updatedAt}>最終更新日：2026年4月4日</Text>

      <Text style={styles.body}>
        ともなり（以下「運営者」）は、アプリ「シュッピー」（以下「本アプリ」）におけるユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
      </Text>

      <Text style={styles.heading}>1. 収集する情報</Text>
      <Text style={styles.body}>
        本アプリでは、以下の情報を収集・利用します。{'\n'}
        {'\n'}
        【Googleアカウント情報】{'\n'}
        ・表示名、メールアドレス、プロフィール画像{'\n'}
        ・Googleログインにより取得し、認証情報として管理します。{'\n'}
        {'\n'}
        【レシート画像】{'\n'}
        ・カメラで撮影されたレシート画像はOCR（文字認識）処理のため外部サービスに送信されます。{'\n'}
        ・画像はサーバーに永続的に保存されません。処理完了後、テキストデータのみが利用されます。{'\n'}
        {'\n'}
        【支出データ】{'\n'}
        ・レシートから読み取った支出情報（日付、金額、品目、カテゴリ等）はお使いの端末内に保存されます。{'\n'}
        ・サーバーには送信されません。{'\n'}
        {'\n'}
        【AIチャット履歴】{'\n'}
        ・AIとの相談履歴はお使いの端末内に保存されます。{'\n'}
        ・AI応答生成のため外部サービスに送信されますが、送信されたデータがAIモデルの学習に使用されることはありません。{'\n'}
        {'\n'}
        【決済情報】{'\n'}
        ・サブスクリプションおよびコイン購入の決済は外部の決済サービスを通じて処理されます。{'\n'}
        ・クレジットカード情報等は決済サービスが管理し、本アプリでは一切保存しません。{'\n'}
        {'\n'}
        【端末ID】{'\n'}
        ・初回特典の不正利用防止のため、端末の識別子を取得・保存する場合があります。{'\n'}
        {'\n'}
        【サーバーに保存するデータ】{'\n'}
        ・現在のプラン、月間利用回数（レシート撮影・AI相談）、追加購入枠の残高、コイン残高、コイン取引履歴、シーズンスキャン数、端末ID{'\n'}
        ・これらはサービス提供に必要な最低限のデータです。
      </Text>

      <Text style={styles.heading}>2. 情報の利用目的</Text>
      <Text style={styles.body}>
        収集した情報は、以下の目的で利用します。{'\n'}
        {'\n'}
        ・本アプリの機能提供（レシート読み取り、支出管理、AI相談）{'\n'}
        ・サブスクリプション・課金の管理{'\n'}
        ・利用状況の把握とサービス改善{'\n'}
        ・ユーザーからのお問い合わせへの対応
      </Text>

      <Text style={styles.heading}>3. 第三者への提供</Text>
      <Text style={styles.body}>
        運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。{'\n'}
        {'\n'}
        ・ユーザーの同意がある場合{'\n'}
        ・法令に基づく場合{'\n'}
        ・サービス提供に必要な外部サービス（以下）への委託{'\n'}
        {'\n'}
        【利用する外部サービス】{'\n'}
        ・Google LLC - 認証、AI応答生成{'\n'}
        ・Microsoft Corporation - 文字認識処理{'\n'}
        ・Apple Inc. - アプリ内課金処理
      </Text>

      <Text style={styles.heading}>4. データの保存と管理</Text>
      <Text style={styles.body}>
        ・端末内データ（支出、チャット履歴）はお使いの端末にのみ保存されます。アプリを削除するとこれらのデータも削除されます。{'\n'}
        ・サーバー上のデータはアカウント削除時に完全に削除されます。{'\n'}
        ・運営者は適切な安全管理措置を講じ、個人情報の漏洩、紛失、毀損の防止に努めます。
      </Text>

      <Text style={styles.heading}>5. ユーザーの権利</Text>
      <Text style={styles.body}>
        ユーザーは以下の権利を有します。{'\n'}
        {'\n'}
        ・アカウントの削除：設定画面からいつでもアカウントとサーバー上のすべてのデータを削除できます。{'\n'}
        ・データのエクスポート：CSVエクスポート機能により、支出データを書き出すことができます。{'\n'}
        ・個人情報の開示・訂正・削除の請求：下記お問い合わせ先までご連絡ください。
      </Text>

      <Text style={styles.heading}>6. 子どもの個人情報</Text>
      <Text style={styles.body}>
        本アプリは13歳未満の方を対象としておらず、意図的に13歳未満の方から個人情報を収集することはありません。
      </Text>

      <Text style={styles.heading}>7. ポリシーの変更</Text>
      <Text style={styles.body}>
        運営者は、必要に応じて本ポリシーを変更できるものとします。変更後のポリシーは、本アプリ内に掲示した時点から効力を生じます。
      </Text>

      <Text style={styles.heading}>お問い合わせ</Text>
      <Text style={styles.body}>
        本ポリシーに関するお問い合わせは以下までご連絡ください。{'\n'}
        {'\n'}
        運営者：ともなり{'\n'}
        メール：tomonyal1224@gmail.com
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  updatedAt: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginBottom: SPACING.lg,
  },
  heading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  body: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
