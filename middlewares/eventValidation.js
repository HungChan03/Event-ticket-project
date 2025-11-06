// middlewares/eventValidation.js
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const firstChar = trimmed[0];
  const lastChar = trimmed[trimmed.length - 1];
  if ((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return trimmed;
    }
  }

  return trimmed;
};

const extractVenueId = (venueInput) => {
  if (!venueInput) return null;

  if (typeof venueInput === 'string') {
    return venueInput.trim();
  }

  if (typeof venueInput === 'object' && !Array.isArray(venueInput)) {
    return venueInput.venueId || venueInput.id || venueInput._id || null;
  }

  return null;
};

const validateVenueReference = async (value) => {
  if (value === undefined || value === null || value === '') {
    throw new Error('Venue is required');
  }

  const venuePayload = parseMaybeJson(value);
  const venueId = extractVenueId(venuePayload);

  if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
    throw new Error('Invalid venueId');
  }

  const venueExists = await Venue.exists({ _id: venueId });

  if (!venueExists) {
    throw new Error('Selected venue does not exist');
  }

  return true;
};

// Middleware để xử lý lỗi validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Validation rules cho việc tạo sự kiện
const validateCreateEvent = [
  // Validate title
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters')
    .trim(),

  // Validate description
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),

  // Validate venue
  body('venue')
    .custom(validateVenueReference),

  // Validate startDate
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value) => {
      const startDate = new Date(value);
      const now = new Date();
      if (startDate <= now) {
        throw new Error('Start date must be in the future');
      }
      return true;
    }),

  // Validate endDate
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (value) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  // Validate capacity
  body('capacity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Capacity must be a non-negative integer'),

  // Validate categories
  body('categories')
    .optional()
    .custom((value) => {
      if (value) {
        let categoriesData = value;
        if (typeof value === 'string') {
          try {
            categoriesData = JSON.parse(value);
          } catch (e) {
            categoriesData = [value];
          }
        }
        
        if (!Array.isArray(categoriesData)) {
          throw new Error('Categories must be an array');
        }
        
        if (categoriesData.length > 5) {
          throw new Error('Maximum 5 categories allowed');
        }
        
        categoriesData.forEach(category => {
          if (typeof category !== 'string' || category.length > 50) {
            throw new Error('Each category must be a string with max 50 characters');
          }
        });
      }
      return true;
    }),

  // Validate ticketTypes
  body('ticketTypes')
    .optional()
    .custom((value) => {
      if (value) {
        let ticketTypesData = value;
        if (typeof value === 'string') {
          try {
            ticketTypesData = JSON.parse(value);
          } catch (e) {
            throw new Error('Invalid ticket types format');
          }
        }
        
        if (!Array.isArray(ticketTypesData)) {
          throw new Error('Ticket types must be an array');
        }
        
        if (ticketTypesData.length === 0) {
          throw new Error('At least one ticket type is required');
        }
        
        if (ticketTypesData.length > 10) {
          throw new Error('Maximum 10 ticket types allowed');
        }
        
        ticketTypesData.forEach((ticketType, index) => {
          if (!ticketType.name || typeof ticketType.name !== 'string') {
            throw new Error(`Ticket type ${index + 1}: name is required and must be a string`);
          }
          
          if (ticketType.name.length > 50) {
            throw new Error(`Ticket type ${index + 1}: name must not exceed 50 characters`);
          }
          
          if (typeof ticketType.price !== 'number' || ticketType.price < 0) {
            throw new Error(`Ticket type ${index + 1}: price must be a non-negative number`);
          }
          
          if (typeof ticketType.quantity !== 'number' || ticketType.quantity <= 0) {
            throw new Error(`Ticket type ${index + 1}: quantity must be a positive number`);
          }
        });
      }
      return true;
    }),

  handleValidationErrors
];

// Validation rules cho việc cập nhật sự kiện
const validateUpdateEvent = [
  // Validate title
  body('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters')
    .trim(),

  // Validate description
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),

  // Validate venue
  body('venue')
    .optional({ checkFalsy: true })
    .custom(validateVenueReference),

  // Validate startDate
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value) => {
      if (value) {
        const startDate = new Date(value);
        const now = new Date();
        if (startDate <= now) {
          throw new Error('Start date must be in the future');
        }
      }
      return true;
    }),

  // Validate endDate
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),

  // Validate capacity
  body('capacity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Capacity must be a non-negative integer'),

  // Validate categories
  body('categories')
    .optional()
    .custom((value) => {
      if (value) {
        let categoriesData = value;
        if (typeof value === 'string') {
          try {
            categoriesData = JSON.parse(value);
          } catch (e) {
            categoriesData = [value];
          }
        }
        
        if (!Array.isArray(categoriesData)) {
          throw new Error('Categories must be an array');
        }
        
        if (categoriesData.length > 5) {
          throw new Error('Maximum 5 categories allowed');
        }
        
        categoriesData.forEach(category => {
          if (typeof category !== 'string' || category.length > 50) {
            throw new Error('Each category must be a string with max 50 characters');
          }
        });
      }
      return true;
    }),

  // Validate ticketTypes
  body('ticketTypes')
    .optional()
    .custom((value) => {
      if (value) {
        let ticketTypesData = value;
        if (typeof value === 'string') {
          try {
            ticketTypesData = JSON.parse(value);
          } catch (e) {
            throw new Error('Invalid ticket types format');
          }
        }
        
        if (!Array.isArray(ticketTypesData)) {
          throw new Error('Ticket types must be an array');
        }
        
        if (ticketTypesData.length > 10) {
          throw new Error('Maximum 10 ticket types allowed');
        }
        
        ticketTypesData.forEach((ticketType, index) => {
          if (!ticketType.name || typeof ticketType.name !== 'string') {
            throw new Error(`Ticket type ${index + 1}: name is required and must be a string`);
          }
          
          if (ticketType.name.length > 50) {
            throw new Error(`Ticket type ${index + 1}: name must not exceed 50 characters`);
          }
          
          if (typeof ticketType.price !== 'number' || ticketType.price < 0) {
            throw new Error(`Ticket type ${index + 1}: price must be a non-negative number`);
          }
          
          if (typeof ticketType.quantity !== 'number' || ticketType.quantity <= 0) {
            throw new Error(`Ticket type ${index + 1}: quantity must be a positive number`);
          }
        });
      }
      return true;
    }),

  handleValidationErrors
];

// Validation rules cho query parameters
const validateEventQuery = [
  // Validate page
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  // Validate limit
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  // Validate status
  query('status')
    .optional()
    .isIn(['draft', 'pending', 'approved', 'rejected', 'cancelled'])
    .withMessage('Invalid status value'),

  // Validate category
  query('category')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),

  // Validate search
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search term must not exceed 100 characters'),

  handleValidationErrors
];

module.exports = {
  validateCreateEvent,
  validateUpdateEvent,
  validateEventQuery,
  handleValidationErrors
};


