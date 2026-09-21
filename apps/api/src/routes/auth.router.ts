import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: string;
  };

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive)
    return res.status(401).json({ message: 'Invalid credentials.' });

  const match = await user.comparePassword(password);
  if (!match)
    return res.status(401).json({ message: 'Invalid credentials.' });

  if (role && user.role !== role)
    return res.status(401).json({ message: 'Invalid credentials.' });

  const secret = process.env.JWT_SECRET;
  if (!secret)
    return res.status(500).json({ message: 'Server configuration error.' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '8h' }
  );

  return res.status(200).json({
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
    token,
  });
});

router.post('/logout', (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logged out.' });
});

export default router;