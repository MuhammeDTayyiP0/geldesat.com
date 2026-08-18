const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Manually parse .env file to avoid needing 'dotenv' package
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
            }
        });
    } else {
        console.warn("Warning: .env file not found at", envPath);
    }
} catch (e) {
    console.error("Error reading .env file:", e);
}

async function main() {
    console.log("Testing SMTP Configuration...");
    console.log("Host:", process.env.SMTP_HOST);
    console.log("User:", process.env.SMTP_USER);
    console.log("Port:", process.env.SMTP_PORT);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER, // Kendi kendinize gönderin
            to: process.env.SMTP_USER,
            subject: "Test Email",
            text: "If you see this, SMTP is working!",
        });
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error occurred:", error);
    }
}

main();
