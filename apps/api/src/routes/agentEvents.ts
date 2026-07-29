import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as eventService from '../services/eventService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const result = await eventService.getEvents(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await eventService.getEventById(req.params.id, req.user.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, startAt, endAt } = req.body;
    if (!type || !startAt || !endAt) {
      return res.status(400).json({ error: 'type, startAt, and endAt are required' });
    }

    const event = await eventService.createEvent(req.user.id, req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const event = await eventService.updateEvent(req.params.id, req.user.id, req.body);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await eventService.deleteEvent(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/attendees', async (req, res, next) => {
  try {
    const { contactId, role } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });

    const event = await eventService.addEventAttendee(req.params.id, req.user.id, { contactId, role });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const deleted = await eventService.removeEventAttendee(
      req.params.id,
      req.params.attendeeId,
      req.user.id
    );
    if (!deleted) return res.status(404).json({ error: 'Event attendee not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const notes = req.body?.notes ? String(req.body.notes).trim() : '';
    const event = await eventService.markCompleted(req.params.id, req.user.id, notes);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    next(error);
  }
});

export default router;
