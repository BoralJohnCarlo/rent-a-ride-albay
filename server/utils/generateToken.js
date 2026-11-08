import jwt from "jsonwebtoken";

const generateToken = (payload) => {
    return jwt.sign({ credentialVersion: 0, ...payload }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
};

export default generateToken;
