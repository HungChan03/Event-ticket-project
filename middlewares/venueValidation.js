const { body, query } = require('express-validator');
const { handleValidationErrors } = require('./eventValidation');

const parseAmenities = (value) => {
  let amenitiesData = value;

  if (typeof value === 'string') {
    try {
      amenitiesData = JSON.parse(value);
    } catch (error) {
      amenitiesData = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(amenitiesData)) {
    throw new Error('Amenities must be an array of strings');
  }

  amenitiesData.forEach((item) => {
    if (typeof item !== 'string' || item.length > 100) {
      throw new Error('Each amenity must be a string up to 100 characters');
    }
  });

  return true;
};

const validateCreateVenue = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3, max: 150 })
    .withMessage('Name must be between 3 and 150 characters')
    .trim(),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 255 })
    .withMessage('Address must not exceed 255 characters')
    .trim(),
  body('city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters')
    .trim(),
  body('state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters')
    .trim(),
  body('country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters')
    .trim(),
  body('capacity')
    .notEmpty()
    .withMessage('Capacity is required')
    .isInt({ min: 1 })
    .withMessage('Capacity must be an integer greater than zero'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('amenities')
    .optional()
    .custom(parseAmenities),
  body('status')
    .optional()
    .customSanitizer((value) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  handleValidationErrors,
];

const validateUpdateVenue = [
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 3, max: 150 })
    .withMessage('Name must be between 3 and 150 characters')
    .trim(),
  body('address')
    .optional()
    .notEmpty()
    .withMessage('Address cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Address must not exceed 255 characters')
    .trim(),
  body('city')
    .optional()
    .notEmpty()
    .withMessage('City cannot be empty')
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters')
    .trim(),
  body('state')
    .optional()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters')
    .trim(),
  body('country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters')
    .trim(),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacity must be an integer greater than zero'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('amenities')
    .optional()
    .custom(parseAmenities),
  body('status')
    .optional()
    .customSanitizer((value) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  handleValidationErrors,
];

const validateVenueQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ max: 150 })
    .withMessage('Search term must not exceed 150 characters'),
  query('city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters'),
  query('country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters'),
  query('minCapacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('minCapacity must be an integer greater than zero'),
  query('maxCapacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxCapacity must be an integer greater than zero'),
  query('status')
    .optional()
    .customSanitizer((value) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
    .isIn(['active', 'inactive'])
    .withMessage('Status filter must be either active or inactive'),
  handleValidationErrors,
];

module.exports = {
  validateCreateVenue,
  validateUpdateVenue,
  validateVenueQuery,
};
