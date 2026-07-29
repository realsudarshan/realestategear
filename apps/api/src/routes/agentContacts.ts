import { Router } from 'express';
import { prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import * as contactService from '../services/contactService.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

// List contacts
router.get('/', async (req, res, next) => {
  try {
    const result = await contactService.getContacts(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get single contact
router.get('/:id', async (req, res, next) => {
  try {
    const contact = await contactService.getContactById(req.params.id, req.user.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Create contact
router.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, company, type, source, stage, tags, tracks } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required' });
    }
    const contact = await contactService.createContact(req.user.id, {
      firstName, lastName, email, phone, company,
      type: type || 'LEAD',
      source, stage, tags, tracks,
    });
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// Update contact
router.put('/:id', async (req, res, next) => {
  try {
    const contact = await contactService.updateContact(req.params.id, req.user.id, req.body);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

// Delete contact
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await contactService.deleteContact(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Contact not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Link contact to portal user
router.put('/:id/link', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.status(403).json({ error: 'No account membership found' });
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, accountId: member.accountId },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const portalUser = await prisma.user.findFirst({
      where: { email: String(email).toLowerCase() },
    });
    if (!portalUser) return res.status(404).json({ error: 'No portal user found with that email' });

    if (contact.userId && contact.userId !== portalUser.id) {
      return res.status(409).json({ error: 'Contact is already linked to a different portal user' });
    }

    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: { userId: portalUser.id },
    });
    logger.info(`Linked contact ${contact.id} to portal user ${portalUser.id}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Unlink contact from portal user
router.delete('/:id/link', async (req, res, next) => {
  try {
    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.status(403).json({ error: 'No account membership found' });
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, accountId: member.accountId },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    await prisma.contact.update({
      where: { id: contact.id },
      data: { userId: null },
    });
    logger.info(`Unlinked contact ${contact.id} from portal user`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Interactions
router.get('/:id/interactions', async (req, res, next) => {
  try {
    const interactions = await contactService.getInteractions(req.params.id, req.user.id);
    if (!interactions) return res.status(404).json({ error: 'Contact not found' });
    res.json(interactions);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/interactions', async (req, res, next) => {
  try {
    const { type, side, subject, body, occurredAt, duration } = req.body;
    if (!type) return res.status(400).json({ error: 'Interaction type is required' });
    const interaction = await contactService.addInteraction(req.params.id, req.user.id, {
      type, side, subject, body,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      duration: duration ? parseInt(duration) : null,
    });
    if (!interaction) return res.status(404).json({ error: 'Contact not found' });
    res.status(201).json(interaction);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/interactions/:interactionId', async (req, res, next) => {
  try {
    const { type, side, subject, body, occurredAt, duration } = req.body;
    const interaction = await contactService.updateInteraction(
      req.params.id,
      req.params.interactionId,
      req.user.id,
      { type, side, subject, body, occurredAt, duration }
    );
    if (!interaction) return res.status(404).json({ error: 'Interaction not found' });
    res.json(interaction);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/interactions/:interactionId', async (req, res, next) => {
  try {
    const deleted = await contactService.deleteInteraction(
      req.params.id,
      req.params.interactionId,
      req.user.id
    );
    if (!deleted) return res.status(404).json({ error: 'Interaction not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
