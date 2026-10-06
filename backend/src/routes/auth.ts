import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { autoEnrollPlayerInActiveGames } from '../services/enrollmentService';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

function safeUser(user: InstanceType<typeof User>) {
  return {
    _id: user._id,
    playerNumber: user.playerNumber,
    playerTag: user.playerTag,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    status: user.status,
    isSetupComplete: user.isSetupComplete,
  };
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const SetupProfileSchema = z.object({
  nickname: z
    .string()
    .min(2, 'Nickname must be at least 2 characters')
    .max(30, 'Nickname cannot exceed 30 characters')
    .trim(),
});

const AdminRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(2).max(30),
  adminSecret: z.string().min(1),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Public. Requires only email + password.
// Automatically generates a unique playerNumber.
// isSetupComplete remains false until /setup-profile is called.

router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid input',
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { email, password } = parsed.data;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,   // pre-save hook hashes this
      role: 'player',
      isSetupComplete: false,
    });

    await user.save();

    // Automatically enroll new player in currently active/open games
    await autoEnrollPlayerInActiveGames(user._id);

    const token = generateToken(String(user._id), user.role);

    res.status(201).json({
      success: true,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// ─── POST /api/auth/setup-profile ────────────────────────────────────────────
// Protected. Called right after registration.
// Sets the player's nickname and marks isSetupComplete = true.

router.post('/setup-profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = SetupProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid nickname',
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { nickname } = parsed.data;

    // Load full doc so we can save
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Normalize for uniqueness check
    const normalized = nickname.trim().toLowerCase().replace(/\s+/g, ' ');

    // Check if another player already uses this nickname (case/space insensitive)
    const existing = await User.findOne({
      nicknameNormalized: normalized,
      _id: { $ne: user._id },
      isSetupComplete: true,
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'This name is already being used by another player. Please use your exact group name or contact the admin if there is a problem.',
      });
      return;
    }

    user.nickname = nickname.trim();
    user.nicknameNormalized = normalized;
    user.isSetupComplete = true;
    await user.save();

    // Ensure player is enrolled in active games
    await autoEnrollPlayerInActiveGames(user._id);

    res.json({
      success: true,
      user: safeUser(user),
    });
  } catch (err) {
    console.error('Setup profile error:', err);
    res.status(500).json({ success: false, message: 'Server error during profile setup' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Login by email + password.
// Response includes isSetupComplete so the frontend can redirect correctly.

router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid input',
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const token = generateToken(String(user._id), user.role);

    if (user.role === 'player') {
      await autoEnrollPlayerInActiveGames(user._id);
    }

    res.json({
      success: true,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ─── POST /api/auth/register-admin ───────────────────────────────────────────
// One-time admin creation using ADMIN_SECRET env var.

router.post('/register-admin', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = AdminRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const { email, password, nickname, adminSecret } = parsed.data;

    if (adminSecret !== process.env.ADMIN_SECRET) {
      res.status(403).json({ success: false, message: 'Invalid admin secret' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already in use' });
      return;
    }

    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      nickname,
      role: 'admin',
      isSetupComplete: true,
    });

    await user.save();

    const token = generateToken(String(user._id), user.role);

    res.status(201).json({
      success: true,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    console.error('Register-admin error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', authenticate, (_req: AuthRequest, res: Response): void => {
  res.json({ success: true, message: 'Logged out' });
});

export default router;
