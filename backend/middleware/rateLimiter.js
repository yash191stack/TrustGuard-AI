/**
 * Rate Limiter Middleware — In-Memory
 * 
 * Cost Optimization: Prevents abuse and excessive API consumption.
 * 30 requests per minute per IP address.
 */

class RateLimiter {
  constructor() {
    this.windowMs = 60 * 1000; // 1 minute window
    this.maxRequests = 30;
    this.requests = new Map(); // IP -> { count, resetTime }

    // Cleanup expired entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.requests.entries()) {
        if (now > data.resetTime) {
          this.requests.delete(ip);
        }
      }
    }, 2 * 60 * 1000);
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();

      let record = this.requests.get(ip);

      // Create new record or reset expired window
      if (!record || now > record.resetTime) {
        record = {
          count: 0,
          resetTime: now + this.windowMs
        };
        this.requests.set(ip, record);
      }

      record.count++;

      // Set rate limit headers
      const remaining = Math.max(0, this.maxRequests - record.count);
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
      });

      if (record.count > this.maxRequests) {
        res.set('Retry-After', retryAfter.toString());
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Maximum ${this.maxRequests} requests per minute. Try again in ${retryAfter} seconds.`,
          retryAfter
        });
      }

      next();
    };
  }

  getStats() {
    return {
      activeClients: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }
}

module.exports = new RateLimiter();
