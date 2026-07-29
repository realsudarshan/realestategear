import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { streamChat, generateMarketingCopy, saveConversation, getConversations } from '../services/aiService.js';
import { chatWithTools } from '../services/aiChatService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

function normalizeChatMessages(messages) {
  if (!Array.isArray(messages)) return null;

  const normalized = [];
  for (const message of messages.slice(-50)) {
    if (!message || typeof message !== 'object') return null;
    if (!['user', 'assistant'].includes(message.role)) return null;
    if (typeof message.content !== 'string') return null;
    normalized.push({
      role: message.role,
      content: message.content.slice(0, 20_000),
    });
  }

  return normalized;
}

// SSE streaming chat with tool calling
router.post('/chat', async (req, res, next) => {
  try {
    const { messages } = req.body;
    const normalizedMessages = normalizeChatMessages(messages);

    if (!normalizedMessages) {
      return res.status(400).json({ error: 'messages must contain only user/assistant text messages' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const entities = await chatWithTools(req.user.id, normalizedMessages, (chunk) => {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      });
      res.write(`data: ${JSON.stringify({ entities, done: true })}\n\n`);
    } catch (aiError) {
      res.write(`data: ${JSON.stringify({ error: aiError.message || 'AI service unavailable' })}\n\n`);
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    }
  }
});

// Generate marketing copy
router.post('/marketing-copy', async (req, res, next) => {
  try {
    const { type, context } = req.body;
    if (!type || !context) {
      return res.status(400).json({ error: 'type and context are required' });
    }
    const content = await generateMarketingCopy(type, context);
    res.json({ content });
  } catch (error) {
    next(error);
  }
});

// Get conversation history
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await getConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// Save conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const { title, messages } = req.body;
    const conversation = await saveConversation(req.user.id, title, messages);
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

export default router;
