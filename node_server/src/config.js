import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  pythonApiUrl: process.env.PYTHON_API_URL || "http://127.0.0.1:8000",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gyan_sarthi",
  adminSignupCode: process.env.ADMIN_SIGNUP_CODE || "",
};
