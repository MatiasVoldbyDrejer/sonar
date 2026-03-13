export function isWhatsAppEnabled(): boolean {
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_VERIFY_TOKEN
  );
}

export function getUserPhone(): string | undefined {
  return process.env.WHATSAPP_USER_PHONE;
}

export async function sendWhatsAppMessage(text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = getUserPhone();

  if (!phoneNumberId || !accessToken || !to) {
    throw new Error('WhatsApp not configured');
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${body}`);
  }
}

export function convertMarkdownToWhatsApp(md: string): string {
  let text = md;
  // Strip {{TICKER|ISIN}} patterns → TICKER
  text = text.replace(/\{\{([^|}]+)\|[^}]+\}\}/g, '$1');
  // Headings → bold
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  // **bold** → *bold*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  return text;
}

export function chunkMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt <= 0) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export async function sendTemplate(
  templateName: string,
  languageCode = 'en'
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = getUserPhone();

  if (!phoneNumberId || !accessToken || !to) {
    throw new Error('WhatsApp not configured');
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp template API error ${res.status}: ${body}`);
  }
}

export async function sendLongMessage(text: string): Promise<void> {
  const converted = convertMarkdownToWhatsApp(text);
  const chunks = chunkMessage(converted);

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await sendWhatsAppMessage(chunks[i]);
  }
}
