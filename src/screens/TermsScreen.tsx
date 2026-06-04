import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>利用規約</Text>
      <Text style={styles.updatedAt}>最終更新日：2026年4月4日</Text>

      <Text style={styles.body}>
        本利用規約（以下「本規約」）は、ともなり（以下「運営者」）が提供するアプリ「シュッピー」（以下「本アプリ」）の利用条件を定めるものです。本アプリをご利用いただく場合、本規約に同意したものとみなします。
      </Text>

      <Text style={styles.heading}>第1条（適用）</Text>
      <Text style={styles.body}>
        本規約は、ユーザーと運営者との間の本アプリの利用に関わる一切の関係に適用されます。
      </Text>

      <Text style={styles.heading}>第2条（アカウント）</Text>
      <Text style={styles.body}>
        1. 本アプリはGoogleアカウントまたはApple IDによるログインが必要です。{'\n'}
        2. ユーザーは自己の責任においてアカウントを管理するものとします。{'\n'}
        3. ユーザーはいつでもアプリ内の設定画面からアカウントを削除できます。アカウントを削除すると、関連するすべてのデータが完全に削除されます。
      </Text>

      <Text style={styles.heading}>第3条（サブスクリプション・課金）</Text>
      <Text style={styles.body}>
        1. 本アプリはフリープラン（無料）のほか、ライト・スタンダード・プレミアムの有料プランを提供します。{'\n'}
        2. 有料プランは月額課金制（自動更新サブスクリプション）です。{'\n'}
        3. サブスクリプションの購入はAppleのApp内課金を通じて行われます。{'\n'}
        4. サブスクリプションは現在の期間が終了する24時間前までにキャンセルしない限り、自動的に更新されます。{'\n'}
        5. サブスクリプションの管理およびキャンセルは、iOSの「設定」アプリから行えます。{'\n'}
        6. コインの購入は都度課金であり、返金はAppleの規約に従います。{'\n'}
        7. 料金は予告なく変更される場合があります。変更前に契約中のユーザーには、次回更新時から新料金が適用されます。
      </Text>

      <Text style={styles.heading}>第4条（禁止事項）</Text>
      <Text style={styles.body}>
        ユーザーは以下の行為をしてはなりません。{'\n'}
        {'\n'}
        ・法令または公序良俗に違反する行為{'\n'}
        ・不正アクセス、リバースエンジニアリング等の行為{'\n'}
        ・本アプリのサーバーやネットワークに過度な負荷をかける行為{'\n'}
        ・他のユーザーの利用を妨害する行為{'\n'}
        ・運営者が不適切と判断する行為
      </Text>

      <Text style={styles.heading}>第5条（サービスの変更・停止）</Text>
      <Text style={styles.body}>
        1. 運営者は、事前の通知なく本アプリの内容を変更、または提供を停止・中断することができます。{'\n'}
        2. 運営者は、本アプリの提供停止等によりユーザーに生じた損害について、一切の責任を負いません。
      </Text>

      <Text style={styles.heading}>第6条（免責事項）</Text>
      <Text style={styles.body}>
        1. 本アプリは「現状のまま」提供されます。運営者は、本アプリの完全性、正確性、有用性等について保証しません。{'\n'}
        2. レシートのOCR読み取り結果やAIによるアドバイスの正確性は保証されません。{'\n'}
        3. 本アプリの利用に起因してユーザーに生じた損害について、運営者は故意または重過失がある場合を除き、一切の責任を負いません。
      </Text>

      <Text style={styles.heading}>第7条（知的財産権）</Text>
      <Text style={styles.body}>
        本アプリに関する知的財産権は、運営者または正当な権利者に帰属します。
      </Text>

      <Text style={styles.heading}>第8条（規約の変更）</Text>
      <Text style={styles.body}>
        運営者は、必要に応じて本規約を変更できるものとします。変更後の規約は、本アプリ内に掲示した時点から効力を生じます。
      </Text>

      <Text style={styles.heading}>お問い合わせ</Text>
      <Text style={styles.body}>
        本規約に関するお問い合わせは以下までご連絡ください。{'\n'}
        {'\n'}
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
