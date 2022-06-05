import rateLimit, { MemoryStore } from "express-rate-limit";

const globalRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, //10 minutes,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MemoryStore()
});

const uploadRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MemoryStore()
});

export {
    globalRateLimiter,
    uploadRateLimiter
};