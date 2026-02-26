const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');

class AuthService {
  // Register new user
  async register(name, email, password) {
    try {
      // Check if user already exists
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (userCheck.rows.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert new user
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, passwordHash]
      );

      const user = result.rows[0];
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Store session
      await this.storeSession(user.id, token);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Find user by email
      const result = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Store session
      await this.storeSession(user.id, token);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Store session token
  async storeSession(userId, token) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Clean up any existing sessions for this user/token
    await pool.query(
      'DELETE FROM user_sessions WHERE user_id = $1 OR token = $2',
      [userId, token]
    );
    
    await pool.query(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
  }

  // Validate token
  async validateToken(token) {
    try {
      // Decode JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Check if session exists and is not expired
      const result = await pool.query(
        'SELECT user_id FROM user_sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid or expired token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Logout user
  async logout(token) {
    await pool.query(
      'DELETE FROM user_sessions WHERE token = $1',
      [token]
    );
  }

  // Clean expired sessions
  async cleanupExpiredSessions() {
    await pool.query(
      'DELETE FROM user_sessions WHERE expires_at < NOW()'
    );
  }
}

module.exports = new AuthService();
