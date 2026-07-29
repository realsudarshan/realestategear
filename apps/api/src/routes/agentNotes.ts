import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as noteService from '../services/noteService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const result = await noteService.getNotes(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { body, contactId, transactionId, propertyId, eventId } = req.body;
    if (!body) return res.status(400).json({ error: 'Note body is required' });
    const note = await noteService.createNote(req.user.id, {
      body, contactId, transactionId, propertyId, eventId,
    });
    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const note = await noteService.updateNote(req.params.id, req.user.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await noteService.deleteNote(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Note not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
