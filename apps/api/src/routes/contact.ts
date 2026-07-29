import express from 'express';
import Joi from 'joi';
import { prisma } from 'db';
import { validateRequest } from '../middleware/validation.js';
import { processContactSubmission } from '../services/portalBridgeService.js';
import { enqueue as enqueueLeadResponse } from '../services/leadResponseAgentService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const contactSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).optional().allow(''),
  inquiryType: Joi.string()
    .valid(
      'buying',
      'selling',
      'renting',
      'property-management',
      'investment',
      'other'
    )
    .required(),
  message: Joi.string().min(10).max(5000).required(),
});

// POST /api/contact - Public contact form submission
router.post(
  '/',
  validateRequest({ body: contactSchema }),
  async (req, res, next) => {
    try {
      const { firstName, lastName, email, phone, inquiryType, message } =
        req.body;

      const submission = await prisma.contactSubmission.create({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          inquiryType,
          message,
        },
      });

      processContactSubmission(submission.id)
        .then(() => enqueueLeadResponse('contact_submission', submission.id))
        .catch(() => {});

      logger.info(`Contact submission from ${email} (${inquiryType})`);

      res.status(201).json({
        message: 'Thank you for your message. We will be in touch soon.',
      });
    } catch (error) {
      logger.error('Contact form error:', error);
      next(error);
    }
  }
);

export default router;
