export interface TelegramDeliveryResult {
  delivered: boolean;
  deliveredTo: string[];
  tokenConfigured: boolean;
  chatIdConfigured: boolean;
  botUsername: string | null;
  diagnostic: string;
}

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTelegramCredentials(): { token: string; chatId: string } {
  const token = (
    process.env.TELEGRAM_BOT_TOKEN ??
    process.env.TELEGRAM_TOKEN ??
    process.env.BOT_TOKEN ??
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  const chatId = (
    process.env.TELEGRAM_CHAT_ID ??
    process.env.CHAT_ID ??
    process.env.TELEGRAM_CHAT ??
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  return { token, chatId };
}

async function sendChunkedMessage(
  token: string,
  chatId: string | number,
  htmlText: string,
  plainText: string,
): Promise<{ ok: boolean; error?: string }> {
  const maxLen = 3900;
  const useHtml = htmlText.length <= maxLen;
  const textToSend = useHtml ? htmlText : plainText.slice(0, maxLen);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: textToSend,
      parse_mode: useHtml ? 'HTML' : undefined,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (res.ok) return { ok: true };

  // Fallback to plain text if HTML tags failed to parse
  const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: plainText.slice(0, maxLen),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (fallbackRes.ok) return { ok: true };
  const detail = await fallbackRes.text().catch(() => '');
  return { ok: false, error: `HTTP ${fallbackRes.status}: ${detail.slice(0, 160)}` };
}

/**
 * Delivers Telegram HTML notifications using the exact same Bot Token / Chat ID
 * + getUpdates auto-discovery pattern as scripts/daily-evaluation.ts.
 */
export async function deliverTelegramMessage(
  htmlText: string,
  plainText: string,
): Promise<TelegramDeliveryResult> {
  const { token, chatId: rawChatId } = getTelegramCredentials();
  const deliveredTo: string[] = [];

  if (!token) {
    return {
      delivered: false,
      deliveredTo,
      tokenConfigured: false,
      chatIdConfigured: Boolean(rawChatId),
      botUsername: null,
      diagnostic: 'TELEGRAM_BOT_TOKEN belum dikonfigurasi di GitHub Actions Secrets.',
    };
  }

  let botUsername: string | null = null;
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as { result?: { username?: string } };
      if (me.result?.username) botUsername = `@${me.result.username}`;
    } else {
      const detail = await meRes.text().catch(() => '');
      return {
        delivered: false,
        deliveredTo,
        tokenConfigured: true,
        chatIdConfigured: Boolean(rawChatId),
        botUsername: null,
        diagnostic: `TELEGRAM_BOT_TOKEN ditolak (HTTP ${meRes.status}): ${detail.slice(0, 120)}`,
      };
    }
  } catch {
    // Continue to send attempt
  }

  let lastError = '';
  if (rawChatId) {
    try {
      const res = await sendChunkedMessage(token, rawChatId, htmlText, plainText);
      if (res.ok) {
        deliveredTo.push(`Telegram (${botUsername ?? 'Bot'} -> chat_id: ${rawChatId})`);
      } else {
        lastError = res.error ?? 'Gagal mengirim ke TELEGRAM_CHAT_ID';
      }
    } catch (err) {
      lastError = String(err);
    }
  }

  // Fallback auto-discovery via getUpdates if direct chat_id was omitted or failed
  if (deliveredTo.length === 0) {
    try {
      const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (updatesRes.ok) {
        const data = (await updatesRes.json()) as {
          result?: Array<{
            message?: { chat?: { id?: number } };
            my_chat_member?: { chat?: { id?: number } };
            channel_post?: { chat?: { id?: number } };
          }>;
        };
        const ids = new Set<number>();
        for (const item of data.result ?? []) {
          const id =
            item.message?.chat?.id ??
            item.my_chat_member?.chat?.id ??
            item.channel_post?.chat?.id;
          if (id != null) ids.add(id);
        }
        for (const id of ids) {
          const res = await sendChunkedMessage(token, id, htmlText, plainText);
          if (res.ok) {
            deliveredTo.push(`Telegram (${botUsername ?? 'Bot'} -> auto chat_id: ${id})`);
          } else if (res.error) {
            lastError = res.error;
          }
        }
      }
    } catch (err) {
      lastError = String(err);
    }
  }

  if (deliveredTo.length > 0) {
    return {
      delivered: true,
      deliveredTo,
      tokenConfigured: true,
      chatIdConfigured: Boolean(rawChatId),
      botUsername,
      diagnostic: `Terkirim ke ${deliveredTo.join(', ')}`,
    };
  }

  return {
    delivered: false,
    deliveredTo,
    tokenConfigured: true,
    chatIdConfigured: Boolean(rawChatId),
    botUsername,
    diagnostic: lastError || 'Gagal kirim ke Telegram (pastikan sudah /start ke bot).',
  };
}
