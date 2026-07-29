import OpenAI from 'openai';
import { prisma } from 'db';

let openai;

function getClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SYSTEM_PROMPT = `You are an AI assistant for a residential real estate agent. You are knowledgeable about:
- Real estate transactions, contracts, and closing processes
- Market analysis and comparative market analysis (CMA)
- Property valuation and pricing strategies
- Marketing and advertising for real estate
- Client relationship management
- Local market trends and neighborhood analysis

Be concise, professional, and actionable. When providing market analysis, use data-driven insights.`;

export async function streamChat(messages, onChunk) {
  const client = getClient();

  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    stream: true,
    max_tokens: 2000,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullContent += content;
      onChunk(content);
    }
  }

  return fullContent;
}

export async function generateCMA(subjectProperty, comparables) {
  const client = getClient();

  const prompt = `Generate a comprehensive Comparative Market Analysis (CMA) report.

SUBJECT PROPERTY:
${JSON.stringify(subjectProperty, null, 2)}

COMPARABLE PROPERTIES:
${JSON.stringify(comparables, null, 2)}

Provide your analysis in the following format:
1. Executive Summary (2-3 sentences)
2. Subject Property Overview
3. Comparable Analysis (for each comparable, discuss similarities, differences, and adjustments)
4. Market Conditions & Trends
5. Recommended Price Range (with justification)
6. Marketing Recommendations

Be specific with dollar amounts and percentages. Reference specific property features for adjustments.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a real estate market analyst expert. Provide detailed, data-driven CMA reports.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 3000,
  });

  return response.choices[0].message.content;
}

export async function generateMarketingCopy(type, context) {
  const client = getClient();

  const prompts = {
    listing_description: `Write a compelling MLS listing description for this property:\n${JSON.stringify(context, null, 2)}\n\nThe description should be engaging, highlight key features, and be 150-250 words.`,
    social_post: `Create a social media post for this property listing:\n${JSON.stringify(context, null, 2)}\n\nMake it engaging, include relevant hashtags, and keep it under 280 characters for Twitter compatibility. Also provide a longer Instagram caption version.`,
    email_template: `Write a professional email to send to potential buyers about this property:\n${JSON.stringify(context, null, 2)}\n\nInclude subject line, body, and call-to-action. Keep it professional but warm.`,
    open_house: `Create an open house announcement for this property:\n${JSON.stringify(context, null, 2)}\n\nInclude key details, highlights, and a compelling hook.`,
  };

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a real estate marketing copywriter. Create compelling, professional content.' },
      { role: 'user', content: prompts[type] || prompts.listing_description },
    ],
    max_tokens: 1500,
  });

  return response.choices[0].message.content;
}

export async function saveConversation(userId, title, messages) {
  return prisma.aIConversation.create({
    data: {
      userId,
      title: title || messages[0]?.content?.slice(0, 50) || 'New conversation',
      messages: {
        create: messages.map((m) => ({
          role: m.role,
          content: m.content,
          metadata: m.metadata || undefined,
        })),
      },
    },
    include: { messages: true },
  });
}

export async function getConversations(userId) {
  return prisma.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}
