import { Router } from 'express';
import { prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import * as taskService from '../services/taskService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

async function resolveAccountId(userId: string): Promise<string | null> {
  const member = await prisma.accountMember.findFirst({ where: { userId } });
  return member?.accountId ?? null;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await taskService.getTasks(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const accountId = await resolveAccountId(req.user.id);
    if (!accountId) return res.status(403).json({ error: 'No account found for user' });

    const { title, description, dueDate, priority, status, contactId, transactionId } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const task = await taskService.createTask(req.user.id, {
      accountId,
      title: title.trim(),
      ...(description != null && description !== '' && { description }),
      ...(dueDate && { dueDate }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(contactId && { contactId }),
      ...(transactionId && { transactionId }),
    });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, description, dueDate, priority, status, contactId, transactionId } = req.body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description || null;
    if (dueDate !== undefined) updates.dueDate = dueDate || null;
    if (priority) updates.priority = priority;
    if (status) updates.status = status;
    if (contactId !== undefined) updates.contactId = contactId || null;
    if (transactionId !== undefined) updates.transactionId = transactionId || null;

    const task = await taskService.updateTask(req.params.id, req.user.id, updates);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await taskService.deleteTask(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
