const sgMail = require('@sendgrid/mail');
require('dotenv').config();


sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const sendOTPEmail = async (email, otp) => {
    try {
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            You have requested to reset your password.
                        </p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 30px 0;">
                            <p style="color: #666; margin: 0 0 10px 0;">Your OTP is:</p>
                            <p style="font-size: 32px; font-weight: bold; color: #007bff; margin: 0; letter-spacing: 5px;">
                                ${otp}
                            </p>
                        </div>
                        <p style="color: #666; font-size: 14px;">
                            ⏰ This OTP will expire in <strong>10 minutes</strong>.
                        </p>
                        <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            If you didn't request this, please ignore this email or contact support if you have concerns.
                        </p>
                    </div>
                </div>
            `,
            text: `Password Reset Request\n\nYour OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
        };

        await sgMail.send(msg);
        console.log('OTP email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending email via SendGrid:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return false;
    }
};

module.exports = { sendOTPEmail };