import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../database/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all loans for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Get all loans (admin only)
router.get('/admin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const [rows] = await pool.execute(`
      SELECT l.*, u.username 
      FROM loans l 
      JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Apply for a new loan
router.post('/',
  authenticateToken,
  [
    body('amount').isFloat({ min: 1000 }),
    body('interest_rate').isFloat({ min: 0 }),
    body('term_months').isInt({ min: 1 }),
    body('type').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { amount, interest_rate, term_months, type } = req.body;
      const [result] = await pool.execute(
        'INSERT INTO loans (user_id, amount, interest_rate, term_months, type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, amount, interest_rate, term_months, type, 'pending']
      );

      res.status(201).json({ id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create loan application' });
    }
  }
);

// Update loan status (admin only)
router.put('/admin/:id',
  authenticateToken,
  [
    body('status').isIn(['approved', 'rejected']),
  ],
  async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { status } = req.body;
      const [result] = await pool.execute(
        'UPDATE loans SET status = ? WHERE id = ?',
        [status, req.params.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }

      res.json({ message: 'Loan status updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update loan status' });
    }
  }
);

export default router;